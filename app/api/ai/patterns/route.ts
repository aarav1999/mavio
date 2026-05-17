import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { db } from '@/lib/db';
import { PatternDetectorAgent } from '@/agents/pattern-detector-agent';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch last 50 emails for pattern analysis
    const emails = await db.email.findMany({
      where: { userId: session.user.id, isArchived: false },
      orderBy: { receivedAt: 'desc' },
      take: 50,
      select: {
        subject: true,
        fromEmail: true,
        body: true,
        receivedAt: true,
      },
    });

    if (emails.length === 0) {
      return NextResponse.json({ patterns: [] });
    }

    // Run pattern detection
    const patterns = await PatternDetectorAgent.run(
      emails.map(e => ({ ...e, body: e.body || '' }))
    );

    return NextResponse.json({ patterns });
  } catch (error) {
    console.error('[API] Pattern detection error:', error);
    return NextResponse.json(
      { error: 'Failed to detect patterns' },
      { status: 500 }
    );
  }
}
