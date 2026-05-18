/**
 * Email fetching helpers extracted from the main emails route.
 * Reduces duplication and improves maintainability.
 */

import { db } from '@/lib/db';

export interface EmailUpsertData {
  userId: string;
  accountId: string;
  gmailId?: string;
  outlookId?: string;
  providerMessageId?: string;
  threadId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  snippet: string;
  body: string;
  receivedAt: Date;
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
}

export interface DecoratedEmail {
  id: string;
  accountId: string;
  provider: string;
  accountEmail?: string;
  [key: string]: any;
}

/**
 * Fetch archived/trash emails from DB for a specific account.
 * Used by all providers for trash view.
 */
export async function fetchArchivedEmailsFromDB(
  userId: string,
  accountId: string,
  provider: string,
  accountEmail: string | null,
  maxResults: number
): Promise<DecoratedEmail[]> {
  const emails = await db.email.findMany({
    where: {
      userId,
      accountId,
      isArchived: true,
    },
    orderBy: { receivedAt: 'desc' },
    take: maxResults,
  });

  return emails.map(e => ({
    ...e,
    accountId,
    provider,
    accountEmail: accountEmail ?? undefined,
  }));
}

/**
 * Upsert an email to the database with proper error handling.
 * Handles unique constraint violations gracefully.
 */
export async function upsertEmail(
  data: EmailUpsertData,
  provider: 'google' | 'azure-ad' | 'imap'
): Promise<any | null> {
  try {
    // Try to create first
    return await db.email.create({ data });
  } catch (error) {
    // On unique constraint violation, find and update
    let whereClause: any;
    
    if (provider === 'google' && data.gmailId) {
      whereClause = { userId: data.userId, gmailId: data.gmailId };
    } else if (provider === 'azure-ad' && data.outlookId) {
      whereClause = { userId: data.userId, outlookId: data.outlookId };
    } else if (provider === 'imap' && data.providerMessageId) {
      whereClause = { accountId: data.accountId, providerMessageId: data.providerMessageId };
    } else {
      return null;
    }

    const existing = await db.email.findFirst({ where: whereClause });
    
    if (existing) {
      return await db.email.update({
        where: { id: existing.id },
        data: {
          subject: data.subject,
          fromName: data.fromName,
          fromEmail: data.fromEmail,
          toEmail: data.toEmail,
          snippet: data.snippet,
          body: data.body,
          receivedAt: data.receivedAt,
          labels: data.labels,
          isRead: data.isRead,
          isStarred: data.isStarred,
          isArchived: data.isArchived,
        },
      });
    }
    
    return null;
  }
}

/**
 * Sort emails by receivedAt (newest first) and deduplicate by ID.
 */
export function sortAndDeduplicateEmails(emails: any[]): any[] {
  // Sort by received date
  emails.sort((a, b) => {
    const dateA = new Date(a.receivedAt).getTime();
    const dateB = new Date(b.receivedAt).getTime();
    return dateB - dateA;
  });

  // Deduplicate by ID
  return Array.from(
    new Map(emails.map(email => [email.id, email])).values()
  );
}

/**
 * Gmail label ID mapping.
 */
export const GMAIL_LABEL_MAP: Record<string, string> = {
  'INBOX': 'INBOX',
  'DRAFT': 'DRAFT',
  'DRAFTS': 'DRAFT',
  'STARRED': 'STARRED',
  'IMPORTANT': 'IMPORTANT',
  'SENT': 'SENT',
  'SPAM': 'SPAM',
  'TRASH': 'TRASH',
  'CATEGORY_PERSONAL': 'CATEGORY_PERSONAL',
  'CATEGORY_SOCIAL': 'CATEGORY_SOCIAL',
  'CATEGORY_PROMOTIONS': 'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES': 'CATEGORY_UPDATES',
};

/**
 * Outlook folder mapping.
 */
export const OUTLOOK_FOLDER_MAP: Record<string, string> = {
  'sent': 'sentItems',
  'draft': 'drafts',
  'starred': 'inbox',
};

/**
 * Parse Gmail label query to label IDs.
 */
export function parseGmailLabelQuery(q: string | undefined): string[] | undefined {
  if (!q) return ['INBOX'];
  
  if (q.startsWith('label:')) {
    const label = q.replace('label:', '').toUpperCase();
    const labelId = GMAIL_LABEL_MAP[label];
    if (labelId) return [labelId];
  }
  
  return undefined;
}
