export interface ListOptions {
  maxResults?: number;
  pageToken?: string;
  q?: string;
  labelIds?: string[];
}

export interface ThreadSummary {
  id: string;
  historyId?: string;
}

export interface ThreadList {
  threads: ThreadSummary[];
  nextPageToken?: string;
}

export interface SendOptions {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
}

export interface EmailProvider {
  listThreads(opts?: ListOptions): Promise<ThreadList>;
  getThread(threadId: string): Promise<any>;
  sendEmail(opts: SendOptions): Promise<void>;
  archiveEmail(messageId: string): Promise<void>;
  markRead(messageId: string): Promise<void>;
  markUnread(messageId: string): Promise<void>;
  starEmail(messageId: string): Promise<void>;
  unstarEmail(messageId: string): Promise<void>;
  trashEmail(messageId: string): Promise<void>;
  searchEmails(query: string, maxResults?: number): Promise<{ id: string; threadId: string }[]>;
}

export type ProviderType = 'gmail' | 'outlook' | 'imap';
