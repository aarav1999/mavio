import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getThread, parseEmailHeaders, modifyEmail, trashEmail } from '@/lib/gmail/client';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const accessToken = (session as any).accessToken as string;
  const { id } = await params;

  try {
    const thread = await getThread(accessToken, id);
    const messages = (thread.messages ?? []).map(parseEmailHeaders);

    // Mark as read in Gmail
    const firstUnread = thread.messages?.find((m) => m.labelIds?.includes('UNREAD'));
    if (firstUnread?.id) {
      await modifyEmail(accessToken, firstUnread.id, [], ['UNREAD']);
      await db.email.updateMany({
        where: { gmailId: firstUnread.id },
        data: { isRead: true },
      });
    }

    // Get AI data from DB
    const dbEmail = await db.email.findFirst({
      where: { userId: session.user.id, threadId: id },
      orderBy: { receivedAt: 'desc' },
    });

    return NextResponse.json({ messages, aiData: dbEmail });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const accessToken = (session as any).accessToken as string;
  await params; // consume to satisfy Next.js 15 typing

  const body = await req.json();
  const { action, messageId } = body;

  try {
    switch (action) {
      case 'archive':
        await modifyEmail(accessToken, messageId, [], ['INBOX']);
        await db.email.updateMany({ where: { gmailId: messageId }, data: { isArchived: true } });
        break;
      case 'star':
        await modifyEmail(accessToken, messageId, ['STARRED'], []);
        await db.email.updateMany({ where: { gmailId: messageId }, data: { isStarred: true } });
        break;
      case 'unstar':
        await modifyEmail(accessToken, messageId, [], ['STARRED']);
        await db.email.updateMany({ where: { gmailId: messageId }, data: { isStarred: false } });
        break;
      case 'markRead':
        await modifyEmail(accessToken, messageId, [], ['UNREAD']);
        await db.email.updateMany({ where: { gmailId: messageId }, data: { isRead: true } });
        break;
      case 'markUnread':
        await modifyEmail(accessToken, messageId, ['UNREAD'], []);
        await db.email.updateMany({ where: { gmailId: messageId }, data: { isRead: false } });
        break;
      case 'trash':
        await trashEmail(accessToken, messageId);
        await db.email.deleteMany({ where: { gmailId: messageId } });
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
