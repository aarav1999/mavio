export interface ListOptions {
  maxResults?: number;
  pageToken?: string;
  q?: string;
  labelIds?: string[];
  folder?: string; // For IMAP provider to specify folder name
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
  listThreads(accessToken: string, opts?: ListOptions): Promise<ThreadList>;
  getThread(accessToken: string, threadId: string): Promise<any>;
  sendEmail(accessToken: string, opts: SendOptions): Promise<void>;
  archiveEmail(accessToken: string, messageId: string): Promise<void>;
  markRead(accessToken: string, messageId: string): Promise<void>;
  markUnread(accessToken: string, messageId: string): Promise<void>;
  starEmail(accessToken: string, messageId: string): Promise<void>;
  unstarEmail(accessToken: string, messageId: string): Promise<void>;
  trashEmail(accessToken: string, messageId: string): Promise<void>;
  searchEmails(accessToken: string, query: string, maxResults?: number): Promise<{ id: string; threadId: string }[]>;
}

export type ProviderType = 'gmail' | 'outlook' | 'imap';
