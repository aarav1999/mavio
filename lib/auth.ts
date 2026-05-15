import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at: number;
  refresh_token?: string;
} | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    const tokens = await res.json();
    if (!res.ok) {
      console.error('[auth] refresh failed:', tokens);
      return null;
    }
    return {
      access_token: tokens.access_token,
      expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600),
      refresh_token: tokens.refresh_token,
    };
  } catch (err) {
    console.error('[auth] refresh error:', err);
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (!session.user) return session;
      session.user.id = user.id;

      const account = await db.account.findFirst({
        where: { userId: user.id, provider: 'google' },
        orderBy: { id: 'desc' },
      });

      if (!account) {
        (session as any).accessToken = null;
        return session;
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const expiresAt = account.expires_at ?? 0;
      const isExpired = expiresAt - 60 <= nowSec; // refresh 1min before expiry

      if (isExpired && account.refresh_token) {
        const refreshed = await refreshAccessToken(account.refresh_token);
        if (refreshed) {
          await db.account.update({
            where: { id: account.id },
            data: {
              access_token: refreshed.access_token,
              expires_at: refreshed.expires_at,
              ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
            },
          });
          (session as any).accessToken = refreshed.access_token;
          return session;
        }
        // refresh failed → force re-login
        (session as any).accessToken = null;
        (session as any).error = 'RefreshAccessTokenError';
        return session;
      }

      (session as any).accessToken = account.access_token ?? null;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'database',
  },
};
