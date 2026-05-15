import {
  listThreads,
  getThread,
  sendEmail,
  modifyEmail,
  trashEmail,
  searchEmails,
} from '@/lib/gmail/client';
import { EmailProvider, ListOptions, ThreadList, SendOptions } from './interface';

export class GmailProvider implements EmailProvider {
  constructor(private accessToken: string) {}

  async listThreads(opts?: ListOptions): Promise<ThreadList> {
    return listThreads(this.accessToken, opts ?? {});
  }

  async getThread(threadId: string): Promise<any> {
    return getThread(this.accessToken, threadId);
  }

  async sendEmail(opts: SendOptions): Promise<void> {
    return sendEmail(this.accessToken, opts);
  }

  async archiveEmail(messageId: string): Promise<void> {
    return modifyEmail(this.accessToken, messageId, [], ['INBOX']);
  }

  async markRead(messageId: string): Promise<void> {
    return modifyEmail(this.accessToken, messageId, [], ['UNREAD']);
  }

  async markUnread(messageId: string): Promise<void> {
    return modifyEmail(this.accessToken, messageId, ['UNREAD'], []);
  }

  async starEmail(messageId: string): Promise<void> {
    return modifyEmail(this.accessToken, messageId, ['STARRED'], []);
  }

  async unstarEmail(messageId: string): Promise<void> {
    return modifyEmail(this.accessToken, messageId, [], ['STARRED']);
  }

  async trashEmail(messageId: string): Promise<void> {
    return trashEmail(this.accessToken, messageId);
  }

  async searchEmails(query: string, maxResults = 20): Promise<{ id: string; threadId: string }[]> {
    return searchEmails(this.accessToken, query, maxResults);
  }
}
