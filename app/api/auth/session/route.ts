import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, deleteSession } from '@/lib/oauth';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ session: null });
    }
    
    const session = await getSession(sessionToken);
    
    if (!session) {
      return NextResponse.json({ session: null });
    }
    
    
    // Fetch accounts for the session (including IMAP)
    const { db } = await import('@/lib/db');
    const accounts = await db.account.findMany({
      where: {
        userId: session.user.id,
        provider: { in: ['google', 'azure-ad', 'imap'] }
      },
      orderBy: { id: 'desc' },
    });


    return NextResponse.json({
      session: {
        user: session.user,
        accounts: accounts.map(acc => ({
          id: acc.id,
          provider: acc.provider,
          providerAccountId: acc.providerAccountId,
          email: acc.email,
          name: acc.name,
          isHealthy: acc.isHealthy,
          imapHost: acc.imapHost,
          imapPort: acc.imapPort,
          smtpHost: acc.smtpHost,
          smtpPort: acc.smtpPort,
        }))
      }
    });
  } catch (error) {
    console.error('[session API] Error:', error);
    return NextResponse.json({ session: null });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    
    if (sessionToken) {
      await deleteSession(sessionToken);
    }
    
    const response = NextResponse.json({ success: true });
    response.cookies.delete('session_token');
    return response;
  } catch (error) {
    console.error('[session API] Error:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
