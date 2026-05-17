import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { 
  exchangeGoogleCode, 
  getGoogleUserInfo, 
  getOrCreateUser, 
  createOrUpdateOAuthAccount,
  createSession,
  getSession,
  getUserById,
} from '@/lib/oauth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    if (error) {
      return NextResponse.redirect(new URL('/login?error=' + error, req.url));
    }
    
    if (!code || !state) {
      return NextResponse.redirect(new URL('/login?error=missing_params', req.url));
    }
    
    // Verify state
    const cookieStore = await cookies();
    const storedState = cookieStore.get('oauth_state')?.value;
    if (state !== storedState) {
      return NextResponse.redirect(new URL('/login?error=invalid_state', req.url));
    }
    
    // Exchange code for tokens
    const tokens = await exchangeGoogleCode(code);
    
    // Log granted scopes for debugging
    console.log('[Google callback] Token scopes:', tokens.scope);
    console.log('[Google callback] Has gmail.modify:', tokens.scope?.includes('gmail.modify'));
    
    // Extract user info from ID token
    const userInfo = getGoogleUserInfo(tokens.id_token);
    
    // Check if there's an existing session (user is adding another account)
    const existingSessionToken = cookieStore.get('session_token')?.value;
    let user;
    
    if (existingSessionToken) {
      const existingSession = await getSession(existingSessionToken);
      if (existingSession) {
        // User is already logged in, link account to existing user
        // Always use the existing user regardless of email
        user = await getUserById(existingSession.user.id);
        if (!user) {
          console.error('[Google callback] Session user not found in database:', existingSession.user.id);
          // Fallback: create new user if session user not found
          user = await getOrCreateUser(userInfo.email, userInfo.name, userInfo.picture);
        } else {
          console.log('[Google callback] Linking account to existing user:', user.id, user.email);
        }
      } else {
        console.error('[Google callback] Session invalid or expired');
        // No valid session, create new user
        user = await getOrCreateUser(userInfo.email, userInfo.name, userInfo.picture);
      }
    } else {
      console.log('[Google callback] No existing session, creating new user');
      // No session, create new user
      user = await getOrCreateUser(userInfo.email, userInfo.name, userInfo.picture);
    }
    
    // Create or update OAuth account
    await createOrUpdateOAuthAccount({
      userId: user.id,
      provider: 'google',
      providerAccountId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      idToken: tokens.id_token,
    });
    
    // Create or keep existing session
    let sessionToken = existingSessionToken;
    if (!sessionToken) {
      sessionToken = await createSession(user.id);
      console.log('[Google callback] Created new session:', sessionToken);
    } else {
      console.log('[Google callback] Keeping existing session:', sessionToken);
    }
    
    // Set session cookie only if we created a new one
    const response = NextResponse.redirect(new URL('/inbox', req.url));
    if (!existingSessionToken) {
      cookieStore.set('session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }
    
    // Clear state cookie
    cookieStore.delete('oauth_state');
    
    return response;
  } catch (error) {
    console.error('[Google callback] Error:', error);
    return NextResponse.redirect(new URL('/login?error=callback_failed', req.url));
  }
}
