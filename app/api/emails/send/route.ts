import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { sendEmail } from '@/lib/gmail/client';
import { OutlookProvider } from '@/lib/providers/outlook';
import { ProviderFactory } from '@/lib/providers/factory';
import { ImapProvider } from '@/lib/providers/imap';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { to, subject, body, threadId, inReplyTo, accountId } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    // Pick the account to send from. If accountId provided, use it; otherwise the most recent.
    const account = accountId
      ? await db.account.findFirst({
          where: { id: accountId, userId: session.user.id, provider: { in: ['google', 'azure-ad', 'imap'] } },
        })
      : await db.account.findFirst({
          where: { userId: session.user.id, provider: { in: ['google', 'azure-ad', 'imap'] } },
          orderBy: { id: 'desc' },
        });

    if (!account) {
      return NextResponse.json({ error: 'No account found' }, { status: 401 });
    }

    if (account.provider === 'google') {
      if (!account.access_token) return NextResponse.json({ error: 'No access token' }, { status: 401 });
      await sendEmail(account.access_token, { to, subject, body, threadId, inReplyTo });
    } else if (account.provider === 'azure-ad') {
      if (!account.access_token) return NextResponse.json({ error: 'No access token' }, { status: 401 });
      const outlookProvider = new OutlookProvider();
      await outlookProvider.sendEmail(account.access_token, { to, subject, body, threadId: inReplyTo });
    } else if (account.provider === 'imap') {
      const imapProvider = ProviderFactory.create(account) as ImapProvider;
      try {
        await imapProvider.sendEmail('', { to, subject, body, threadId, inReplyTo });
      } finally {
        await imapProvider.disconnect().catch(() => {});
      }
    } else {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[emails/send]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
