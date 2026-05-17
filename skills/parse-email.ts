import { GmailMessage, ParsedEmail } from '@/types/email';

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
