import crypto from 'crypto';
import { db } from '@/lib/db';

// Generate a random state for OAuth flow
export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Generate OAuth authorization URL for Google
export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ].join(' '),
    response_type: 'code',
    prompt: 'consent select_account',
    access_type: 'offline',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Generate OAuth authorization URL for Azure AD
export function getAzureADAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_AD_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/azure-ad`,
    scope: 'openid profile offline_access User.Read Mail.Read Mail.ReadWrite Mail.Send',
    response_type: 'code',
    prompt: 'login',
    state,
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

// Exchange authorization code for tokens (Google)
export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token: string;
  scope?: string;
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to exchange Google code');
  }

  return await res.json();
}

// Refresh Azure AD access token using refresh token
export async function refreshAzureADToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token: string;
}> {
  const res = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[OAuth] Azure AD token refresh failed:', errorText);
    throw new Error('Failed to refresh Azure AD token');
  }

  const tokens = await res.json();
  console.log('[OAuth] Azure AD token refresh successful, access_token length:', tokens.access_token?.length);
  return tokens;
}

// Get valid access token for an account (refresh if expired)
export async function getValidAccessToken(account: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  // If token is not expired (with 5 minute buffer), return it
  if (account.expires_at && account.expires_at > now + 300) {
    return account.access_token;
  }
  
  // Token is expired or expiring soon, refresh it
  if (!account.refresh_token) {
    console.warn('[OAuth] No refresh token available for account:', account.id, '- user needs to re-authenticate');
    // Return current token - caller should handle API errors and prompt re-auth
    return account.access_token;
  }
  
  console.log('[OAuth] Refreshing expired token for account:', account.id);
  const newTokens = await refreshAzureADToken(account.refresh_token);
  
  // Update account with new tokens
  const expiresAt = Math.floor(Date.now() / 1000) + newTokens.expires_in;
  await db.account.update({
    where: { id: account.id },
    data: {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: expiresAt,
      id_token: newTokens.id_token,
    },
  });
  
  return newTokens.access_token;
}

// Exchange authorization code for tokens (Azure AD)
export async function exchangeAzureADCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token: string;
}> {
  const res = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/azure-ad`,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[OAuth] Azure AD token exchange failed:', errorText);
    throw new Error('Failed to exchange Azure AD code');
  }

  const tokens = await res.json();
  console.log('[OAuth] Azure AD token exchange successful, access_token length:', tokens.access_token?.length);
  return tokens;
}

// Get user info from Google ID token
export function getGoogleUserInfo(idToken: string): {
  email: string;
  name: string;
  picture?: string;
  sub: string;
} {
  const parts = idToken.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  return {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
    sub: payload.sub,
  };
}

// Get user info from Azure AD ID token
export function getAzureADUserInfo(idToken: string): {
  email: string;
  name: string;
  sub: string;
} {
  const parts = idToken.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  return {
    email: payload.email || payload.preferred_username,
    name: payload.name,
    sub: payload.sub,
  };
}

// Create or get user by email
export async function getOrCreateUser(email: string, name?: string, image?: string) {
  let user = await db.user.findUnique({ where: { email } });

  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name,
        image,
        emailVerified: new Date(),
      },
    });
  }

  return user;
}

// Get user by ID (for linking accounts)
export async function getUserById(userId: string) {
  return await db.user.findUnique({ where: { id: userId } });
}

// Create or update OAuth account
export async function createOrUpdateOAuthAccount(data: {
  userId: string;
  provider: 'google' | 'azure-ad';
  providerAccountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  idToken?: string;
  email?: string;
  name?: string;
}) {
  const existingAccount = await db.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: data.provider,
        providerAccountId: data.providerAccountId,
      },
    },
  });

  const expiresAt = Math.floor(Date.now() / 1000) + data.expiresIn;

  if (existingAccount) {
    // If the account exists but belongs to a different user, delete it and create a new one
    if (existingAccount.userId !== data.userId) {
      console.log(`[OAuth] Deleting existing ${data.provider} account from old user ${existingAccount.userId} and creating for new user ${data.userId}`);
      // Delete ALL email records for the old user to avoid foreign key constraint issues
      // Use raw SQL to delete by userId
      await db.$executeRaw`DELETE FROM "Email" WHERE "userId" = ${existingAccount.userId}`;
      await db.account.delete({ where: { id: existingAccount.id } });
      return await db.account.create({
        data: {
          userId: data.userId,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          email: data.email,
          name: data.name,
          access_token: data.accessToken,
          refresh_token: data.refreshToken,
          expires_at: expiresAt,
          id_token: data.idToken,
          type: 'oauth',
          token_type: 'bearer',
        },
      });
    }
    // Account already belongs to this user, just update tokens
    return await db.account.update({
      where: { id: existingAccount.id },
      data: {
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
        expires_at: expiresAt,
        id_token: data.idToken,
        email: data.email,
        name: data.name,
      },
    });
  }

  // Create new account
  return await db.account.create({
    data: {
      userId: data.userId,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      email: data.email,
      name: data.name,
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
      expires_at: expiresAt,
      id_token: data.idToken,
      type: 'oauth',
      token_type: 'bearer',
    },
  });
}

// Generate session token
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Create session for user
export async function createSession(userId: string): Promise<string> {
  const sessionToken = generateSessionToken();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.session.create({
    data: {
      sessionToken,
      userId,
      expires,
    },
  });

  return sessionToken;
}

// Get session by token
export async function getSession(sessionToken: string) {
  const session = await db.session.findUnique({
    where: { sessionToken },
    include: {
      user: {
        include: {
          accounts: true,
        },
      },
    },
  });

  if (!session || session.expires < new Date()) {
    return null;
  }

  return session;
}

// Delete session
export async function deleteSession(sessionToken: string) {
  await db.session.deleteMany({ where: { sessionToken } });
}

// Helper to get session from NextRequest
export async function getSessionFromRequest(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const sessionToken = cookies['session_token'];
  if (!sessionToken) return null;

  return await getSession(sessionToken);
}
