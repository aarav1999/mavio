import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateReplyDrafts } from '@/lib/ai/gemini';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { subject, threadBody, userIntent } = await req.json();
    const drafts = await generateReplyDrafts(subject, threadBody, userIntent);
    return NextResponse.json({ drafts });
  } catch (err: any) {
    console.error('[ai/reply]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
