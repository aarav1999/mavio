import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { OutlookProvider } from '@/lib/providers/outlook';
import { ProviderFactory } from '@/lib/providers/factory';
import { ImapProvider } from '@/lib/providers/imap';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  // Look up the email to get its accountId
  const email = await db.email.findFirst({
    where: { id },
  });

  if (!email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  // Get the account associated with this email
  const account = await db.account.findUnique({
    where: { id: (email as any).accountId },
  });

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const provider = account.provider;
  const accessToken = account.access_token;

  if (provider !== 'imap' && !accessToken) {
    return NextResponse.json({ error: 'No access token for account' }, { status: 401 });
  }

  const outlookProvider = new OutlookProvider();

  try {
    let messages: any[];

    if (provider === 'imap') {
      // DB-first: serve cached body if present; otherwise fetch once via IMAP and persist.
      if ((email as any).body && (email as any).body.length > 0) {
        messages = [{
          id: email.id,
          threadId: (email as any).threadId,
          subject: (email as any).subject,
          fromName: (email as any).fromName,
          fromEmail: (email as any).fromEmail,
          toEmail: (email as any).toEmail,
          snippet: (email as any).snippet,
          body: (email as any).body,
          receivedAt: (email as any).receivedAt,
          isRead: (email as any).isRead,
          isStarred: (email as any).isStarred,
          labels: (email as any).labels || [],
        }];
      } else {
        const imapProvider = ProviderFactory.create(account) as ImapProvider;
        try {
          const fetched = await imapProvider.getThread('', (email as any).providerMessageId!);
          await db.email.update({
            where: { id: email.id },
            data: {
              body: fetched.body,
              snippet: fetched.snippet || (email as any).snippet,
              isRead: true,
            },
          });
          messages = [{ ...fetched, id: email.id }];
        } finally {
          await imapProvider.disconnect().catch(() => {});
        }
      }

      const dbEmail = await db.email.findFirst({
        where: { userId: session.user.id, threadId: (email as any).threadId },
        orderBy: { receivedAt: 'desc' },
      });
      return NextResponse.json({ messages, aiData: dbEmail, provider });
    }

    if (provider === 'google') {
      const { getThread, parseEmailHeaders, modifyEmail } = await import('@/lib/gmail/client');
      const thread = await getThread(accessToken!, (email as any).gmailId!);
      messages = (thread.messages ?? []).map(parseEmailHeaders);

      // Mark as read in Gmail
      const firstUnread = thread.messages?.find((m) => m.labelIds?.includes('UNREAD'));
      if (firstUnread?.id) {
        await modifyEmail(accessToken!, firstUnread.id, [], ['UNREAD']);
        await db.email.updateMany({
          where: { gmailId: firstUnread.id },
          data: { isRead: true },
        });
      }
    } else if (provider === 'azure-ad') {
      const msg = await outlookProvider.getThread(accessToken!, (email as any).outlookId!);
      messages = [msg];

      // Mark as read in Outlook
      if (!msg.isRead) {
        await outlookProvider.markRead(accessToken!, (email as any).outlookId!);
        await db.email.updateMany({
          where: { outlookId: (email as any).outlookId } as any,
          data: { isRead: true },
        });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    // Get AI data from DB
    const dbEmail = await db.email.findFirst({
      where: { userId: session.user.id, threadId: (email as any).threadId },
      orderBy: { receivedAt: 'desc' },
    });

    return NextResponse.json({ messages, aiData: dbEmail, provider });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: emailId } = await params;
    const body = await req.json();
    const { action, messageId } = body; // messageId is actually threadId from frontend

    // Look up the email to get its accountId
    const email = await db.email.findFirst({
      where: { id: emailId },
    });

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    if (!(email as any).accountId) {
      return NextResponse.json({ error: 'Email has no associated account' }, { status: 400 });
    }

    // Get the account associated with this email
    const account = await db.account.findUnique({
      where: { id: (email as any).accountId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const provider = account.provider;
    const accessToken = account.access_token;

    if (provider !== 'imap' && !accessToken) {
      return NextResponse.json({ error: 'No access token for account' }, { status: 401 });
    }

    const outlookProvider = new OutlookProvider();

    // For IMAP, provider-side flag ops use the email row id; DB updates key off Email.id.
    if (provider === 'imap') {
      switch (action) {
        case 'markRead':
        case 'markUnread': {
          const imapProvider = ProviderFactory.create(account) as ImapProvider;
          try {
            const uid = (email as any).providerMessageId as string;
            if (uid) {
              if (action === 'markRead') {
                await imapProvider.markRead('', uid);
              } else {
                await imapProvider.markUnread('', uid);
              }
            }
          } catch (err) {
            // Continue with DB update even if flag operation fails
          } finally {
            await imapProvider.disconnect().catch(() => {});
          }
          await db.email.update({
            where: { id: email.id },
            data: { isRead: action === 'markRead' },
          });
          return NextResponse.json({ success: true });
        }
        case 'archive':
          await db.email.update({ where: { id: email.id }, data: { isArchived: true } });
          return NextResponse.json({ success: true });
        case 'trash':
          // Soft delete: mark as archived instead of hard delete
          await db.email.update({ where: { id: email.id }, data: { isArchived: true } });
          return NextResponse.json({ success: true });
        case 'star':
          await db.email.update({ where: { id: email.id }, data: { isStarred: true } });
          return NextResponse.json({ success: true });
        case 'unstar':
          await db.email.update({ where: { id: email.id }, data: { isStarred: false } });
          return NextResponse.json({ success: true });
        default:
          return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
      }
    }

    // We've handled IMAP and rejected null tokens for OAuth above; narrow now.
    if (!accessToken) {
      return NextResponse.json({ error: 'No access token for account' }, { status: 401 });
    }

    // Determine which ID field to use based on provider
    const idField = provider === 'google' ? 'gmailId' : 'outlookId';
    const actualMessageId = provider === 'google' 
      ? (email as any).gmailId 
      : provider === 'azure-ad' 
        ? (email as any).outlookId 
        : (email as any).providerMessageId;

    switch (action) {
      case 'archive':
        if (provider === 'google') {
          const { modifyEmail } = await import('@/lib/gmail/client');
          await modifyEmail(accessToken, actualMessageId, [], ['INBOX']);
        } else if (provider === 'azure-ad') {
          await outlookProvider.archiveEmail(accessToken, actualMessageId);
        }
        await db.email.updateMany({ where: { [idField]: actualMessageId }, data: { isArchived: true } });
        break;
      case 'star':
        if (provider === 'google') {
          const { modifyEmail } = await import('@/lib/gmail/client');
          await modifyEmail(accessToken, actualMessageId, ['STARRED'], []);
        } else if (provider === 'azure-ad') {
          await outlookProvider.starEmail(accessToken, actualMessageId);
        }
        await db.email.updateMany({ where: { [idField]: actualMessageId }, data: { isStarred: true } });
        break;
      case 'unstar':
        if (provider === 'google') {
          const { modifyEmail } = await import('@/lib/gmail/client');
          await modifyEmail(accessToken, actualMessageId, [], ['STARRED']);
        } else if (provider === 'azure-ad') {
          await outlookProvider.unstarEmail(accessToken, actualMessageId);
        }
        await db.email.updateMany({ where: { [idField]: actualMessageId }, data: { isStarred: false } });
        break;
      case 'markRead':
        if (provider === 'google') {
          const { modifyEmail } = await import('@/lib/gmail/client');
          await modifyEmail(accessToken, actualMessageId, [], ['UNREAD']);
        } else if (provider === 'azure-ad') {
          await outlookProvider.markRead(accessToken, actualMessageId);
        }
        await db.email.updateMany({ where: { [idField]: actualMessageId }, data: { isRead: true } });
        break;
      case 'markUnread':
        if (provider === 'google') {
          const { modifyEmail } = await import('@/lib/gmail/client');
          await modifyEmail(accessToken, actualMessageId, ['UNREAD'], []);
        } else if (provider === 'azure-ad') {
          await outlookProvider.markUnread(accessToken, actualMessageId);
        }
        await db.email.updateMany({ where: { [idField]: actualMessageId }, data: { isRead: false } });
        break;
      case 'trash':
        if (provider === 'google') {
          const { trashEmail } = await import('@/lib/gmail/client');
          await trashEmail(accessToken, actualMessageId);
        } else if (provider === 'azure-ad') {
          await outlookProvider.trashEmail(accessToken, actualMessageId);
        }
        // Soft delete: mark as archived instead of hard delete
        await db.email.updateMany({ where: { [idField]: actualMessageId }, data: { isArchived: true } });
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const errorMessage = err.message || 'Action failed';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
