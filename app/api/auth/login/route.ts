import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { provider } = await req.json();
    console.log('[login API] Provider:', provider);
    
    if (!provider || (provider !== 'google' && provider !== 'azure-ad')) {
      console.error('[login API] Invalid provider:', provider);
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
    
    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    console.log('[login API] Generated state:', state);
    
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
    console.log('[login API] Redirect URI:', redirectUri);
    
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
      console.log('[login API] Google auth URL generated:', authUrl);
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
      console.log('[login API] Azure AD auth URL generated:', authUrl);
    } else {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
    
    console.log('[login API] Returning authUrl:', authUrl);
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('[login API] Error:', error);
    return NextResponse.json({ error: 'Failed to generate auth URL' }, { status: 500 });
  }
}
