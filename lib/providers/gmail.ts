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
  async listThreads(accessToken: string, opts?: ListOptions): Promise<ThreadList> {
    return listThreads(accessToken, opts ?? {});
  }

  async getThread(accessToken: string, threadId: string): Promise<any> {
    return getThread(accessToken, threadId);
  }

  async sendEmail(accessToken: string, opts: SendOptions): Promise<void> {
    return sendEmail(accessToken, opts);
  }

  async archiveEmail(accessToken: string, messageId: string): Promise<void> {
    return modifyEmail(accessToken, messageId, [], ['INBOX']);
  }

  async markRead(accessToken: string, messageId: string): Promise<void> {
    return modifyEmail(accessToken, messageId, [], ['UNREAD']);
  }

  async markUnread(accessToken: string, messageId: string): Promise<void> {
    return modifyEmail(accessToken, messageId, ['UNREAD'], []);
  }

  async starEmail(accessToken: string, messageId: string): Promise<void> {
    return modifyEmail(accessToken, messageId, ['STARRED'], []);
  }

  async unstarEmail(accessToken: string, messageId: string): Promise<void> {
    return modifyEmail(accessToken, messageId, [], ['STARRED']);
  }

  async trashEmail(accessToken: string, messageId: string): Promise<void> {
    return trashEmail(accessToken, messageId);
  }

  async searchEmails(accessToken: string, query: string, maxResults = 20): Promise<{ id: string; threadId: string }[]> {
    return searchEmails(accessToken, query, maxResults);
  }
}
