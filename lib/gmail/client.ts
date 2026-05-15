import { google } from 'googleapis';
import { GmailMessage, EmailThread, ParsedEmail } from '@/types/email';

export function getGmailClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
}

export async function listThreads(
  accessToken: string,
  options: { maxResults?: number; pageToken?: string; q?: string; labelIds?: string[] } = {}
): Promise<{ threads: { id: string; historyId: string }[]; nextPageToken?: string }> {
  const gmail = getGmailClient(accessToken);
  const res = await gmail.users.threads.list({
    userId: 'me',
    maxResults: options.maxResults ?? 20,
    pageToken: options.pageToken,
    q: options.q,
    labelIds: options.labelIds,
  });
  return {
    threads: (res.data.threads as any) ?? [],
    nextPageToken: res.data.nextPageToken ?? undefined,
  };
}

export async function getThread(accessToken: string, threadId: string): Promise<EmailThread> {
  const gmail = getGmailClient(accessToken);
  const res = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
  return res.data as EmailThread;
}

export async function getMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  const gmail = getGmailClient(accessToken);
  const res = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  return res.data as GmailMessage;
}

export async function sendEmail(
  accessToken: string,
  { to, subject, body, threadId, inReplyTo }: {
    to: string;
    subject: string;
    body: string;
    threadId?: string;
    inReplyTo?: string;
  }
): Promise<void> {
  const gmail = getGmailClient(accessToken);
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : '',
    inReplyTo ? `References: ${inReplyTo}` : '',
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].filter(Boolean);

  const raw = Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, ...(threadId ? { threadId } : {}) },
  });
}

export async function modifyEmail(
  accessToken: string,
  messageId: string,
  addLabels: string[] = [],
  removeLabels: string[] = []
): Promise<void> {
  const gmail = getGmailClient(accessToken);
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { addLabelIds: addLabels, removeLabelIds: removeLabels },
  });
}

export async function trashEmail(accessToken: string, messageId: string): Promise<void> {
  const gmail = getGmailClient(accessToken);
  await gmail.users.messages.trash({ userId: 'me', id: messageId });
}

export async function searchEmails(
  accessToken: string,
  query: string,
  maxResults = 20
): Promise<{ id: string; threadId: string }[]> {
  const gmail = getGmailClient(accessToken);
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });
  return (res.data.messages as any) ?? [];
}

export function parseEmailHeaders(message: GmailMessage): ParsedEmail {
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
