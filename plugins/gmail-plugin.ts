import { google } from 'googleapis';
import { GmailMessage, EmailThread } from '@/types/email';
import { EmailProvider, ListOptions, ThreadList, SendOptions } from '@/lib/providers/interface';

export class GmailPlugin implements EmailProvider {
  readonly pluginName = 'GmailPlugin';
  readonly version = '1.0.0';
  readonly description = 'Gmail email provider using Google OAuth and Gmail API';
  readonly status = 'implemented' as const;

  private getClient(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return google.gmail({ version: 'v1', auth });
  }

  async listThreads(accessToken: string, opts?: ListOptions): Promise<ThreadList> {
    const gmail = this.getClient(accessToken);
    const res = await gmail.users.threads.list({
      userId: 'me',
      maxResults: opts?.maxResults ?? 20,
      pageToken: opts?.pageToken,
      q: opts?.q,
      labelIds: opts?.labelIds,
    });
    return {
      threads: (res.data.threads as any) ?? [],
      nextPageToken: res.data.nextPageToken ?? undefined,
    };
  }

  async getThread(accessToken: string, threadId: string): Promise<any> {
    const gmail = this.getClient(accessToken);
    const res = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
    return res.data as EmailThread;
  }

  async sendEmail(accessToken: string, opts: SendOptions): Promise<void> {
    const gmail = this.getClient(accessToken);
    const lines = [
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : '',
      opts.inReplyTo ? `References: ${opts.inReplyTo}` : '',
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      opts.body,
    ].filter(Boolean);

    const raw = Buffer.from(lines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw, ...(opts.threadId ? { threadId: opts.threadId } : {}) },
    });
  }

  async archiveEmail(accessToken: string, messageId: string): Promise<void> {
    const gmail = this.getClient(accessToken);
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: ['ARCHIVED'], removeLabelIds: ['INBOX'] },
    });
  }

  async markRead(accessToken: string, messageId: string): Promise<void> {
    const gmail = this.getClient(accessToken);
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
  }

  async markUnread(accessToken: string, messageId: string): Promise<void> {
    const gmail = this.getClient(accessToken);
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: ['UNREAD'] },
    });
  }

  async starEmail(accessToken: string, messageId: string): Promise<void> {
    const gmail = this.getClient(accessToken);
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: ['STARRED'] },
    });
  }

  async unstarEmail(accessToken: string, messageId: string): Promise<void> {
    const gmail = this.getClient(accessToken);
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { removeLabelIds: ['STARRED'] },
    });
  }

  async trashEmail(accessToken: string, messageId: string): Promise<void> {
    const gmail = this.getClient(accessToken);
    await gmail.users.messages.trash({ userId: 'me', id: messageId });
  }

  async searchEmails(accessToken: string, query: string, maxResults = 20): Promise<{ id: string; threadId: string }[]> {
    const gmail = this.getClient(accessToken);
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });
    return (res.data.messages as any) ?? [];
  }

  // Helper method to parse Gmail message headers
  parseEmailHeaders(message: GmailMessage) {
    const headers = message.payload?.headers ?? [];
    const get = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

    const fromRaw = get('from');
    const fromMatch = fromRaw.match(/^(.*?)\s*<(.+)>$/) ?? [null, fromRaw, fromRaw];
    const fromName = fromMatch[1]?.trim().replace(/^"|"$/g, '') ?? '';
    const fromEmail = fromMatch[2]?.trim() ?? fromRaw;

    let body = '';
    const extractBody = (parts: any[]): string => {
      for (const part of parts ?? []) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.parts) {
          const nested = extractBody(part.parts);
          if (nested) return nested;
        }
      }
      return body;
    };

    if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload?.parts) {
      body = extractBody(message.payload.parts);
    }

    return {
      id: message.id ?? '',
      threadId: message.threadId ?? '',
      subject: get('subject'),
      fromName,
      fromEmail,
      toEmail: get('to'),
      snippet: message.snippet ?? '',
      body,
      isRead: !(message.labelIds?.includes('UNREAD') ?? false),
      isStarred: message.labelIds?.includes('STARRED') ?? false,
      labels: message.labelIds ?? [],
      receivedAt: new Date(parseInt(message.internalDate ?? '0', 10)),
    };
  }
}

export const gmailPlugin = new GmailPlugin();
