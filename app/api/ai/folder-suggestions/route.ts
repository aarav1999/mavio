import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { db } from '@/lib/db';
import { FolderSuggestionAgent } from '@/agents/folder-suggestion-agent';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch recent emails that have AI classification
    const emails = await db.email.findMany({
      where: { 
        userId: session.user.id, 
        isArchived: false,
        aiCategory: { not: null },
      },
      orderBy: { receivedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        subject: true,
        fromEmail: true,
        body: true,
        aiCategory: true,
        aiPriorityLabel: true,
      },
    });

    if (emails.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // Run folder suggestion agent
    const suggestions = await FolderSuggestionAgent.run(
      emails.map(e => ({ 
        ...e, 
        body: e.body || '',
        aiCategory: e.aiCategory || undefined,
        aiPriorityLabel: e.aiPriorityLabel || undefined
      }))
    );

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('[API] Folder suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to generate folder suggestions' },
      { status: 500 }
    );
  }
}
