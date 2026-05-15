import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchEmails, getMessage, parseEmailHeaders } from '@/lib/gmail/client';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const accessToken = (session as any).accessToken as string;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  const maxResults = parseInt(searchParams.get('maxResults') ?? '20');

  if (!q.trim()) return NextResponse.json({ emails: [] });

  try {
    // First try DB search for cached AI-enriched results
    const dbResults = await db.email.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { subject: { contains: q, mode: 'insensitive' } },
          { fromEmail: { contains: q, mode: 'insensitive' } },
          { fromName: { contains: q, mode: 'insensitive' } },
          { snippet: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: maxResults,
      orderBy: { receivedAt: 'desc' },
    });

    if (dbResults.length > 0) {
      return NextResponse.json({ emails: dbResults, source: 'cache' });
    }

    // Fallback to Gmail API search
    const messages = await searchEmails(accessToken, q, maxResults);
    const emails = await Promise.all(
      messages.slice(0, 10).map(async (m) => {
        const msg = await getMessage(accessToken, m.id);
        return parseEmailHeaders(msg);
      })
    );

    return NextResponse.json({ emails, source: 'gmail' });
  } catch (err: any) {
    console.error('[emails/search]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
