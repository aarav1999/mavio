import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { DrafterAgent } from '@/agents/drafter-agent';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { subject, threadBody, userIntent } = await req.json();
    const drafts = await DrafterAgent.run(subject, threadBody, userIntent);
    return NextResponse.json({ drafts });
  } catch (err: any) {
    console.error('[ai/reply]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
