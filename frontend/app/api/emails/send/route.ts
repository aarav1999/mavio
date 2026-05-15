import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendEmail } from '@/lib/gmail/client';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const accessToken = (session as any).accessToken as string;

  try {
    const { to, subject, body, threadId, inReplyTo } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    await sendEmail(accessToken, { to, subject, body, threadId, inReplyTo });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[emails/send]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
