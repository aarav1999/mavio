import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 login attempts per minute per IP
    const clientIP = getClientIP(req.headers);
    const rateLimit = await checkRateLimit(clientIP, {
      limit: 10,
      windowSeconds: 60,
      prefix: 'ratelimit:login:',
    });
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.resetSeconds),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const { provider } = await req.json();
    
    if (!provider || (provider !== 'google' && provider !== 'azure-ad')) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
    
    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Set state cookie
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
    });
    
    // Generate authorization URL
    let authUrl: string;
    const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/callback/${provider}`;
    
    if (provider === 'google') {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify',
        state,
        access_type: 'offline',
        prompt: 'consent select_account',
      });
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    } else if (provider === 'azure-ad') {
      const params = new URLSearchParams({
        client_id: process.env.AZURE_AD_CLIENT_ID || '',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send',
        state,
        response_mode: 'query',
      });
      authUrl = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/oauth2/v2.0/authorize?${params.toString()}`;
    } else {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
    
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('[login API] Error:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}
