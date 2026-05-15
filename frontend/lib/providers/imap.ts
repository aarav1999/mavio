import { EmailProvider, ListOptions, ThreadList, SendOptions } from './interface';

/**
 * ImapProvider — abstraction stub
 *
 * Integration path:
 * - Library: imap-simple (npm) or node-imap
 * - SMTP send: nodemailer
 * - Auth: username/password or OAuth2 (for Yahoo/AOL/custom)
 * - Providers: Yahoo Mail, AOL, Fastmail, self-hosted
 *
 * Notable complexity vs Gmail:
 * - No native thread model — must group by subject/references headers
 * - No server-side push — requires polling or IDLE command
 * - MIME parsing required for body extraction
 *
 * Recommended package: imap-simple + nodemailer + mailparser
 */
export class ImapProvider implements EmailProvider {
  constructor(
    private config: {
      host: string;
      port: number;
      user: string;
      password: string;
      tls: boolean;
    }
  ) {}

  async listThreads(opts?: ListOptions): Promise<ThreadList> {
    throw new Error('ImapProvider: listThreads not yet implemented.');
  }

  async getThread(threadId: string): Promise<any> {
    throw new Error('ImapProvider: getThread not yet implemented.');
  }

  async sendEmail(opts: SendOptions): Promise<void> {
    throw new Error('ImapProvider: sendEmail not yet implemented. Use nodemailer.');
  }

  async archiveEmail(messageId: string): Promise<void> {
    throw new Error('ImapProvider: archiveEmail not yet implemented. Move to Archive mailbox.');
  }

  async markRead(messageId: string): Promise<void> {
    throw new Error('ImapProvider: markRead not yet implemented. Set \\Seen flag.');
  }

  async markUnread(messageId: string): Promise<void> {
    throw new Error('ImapProvider: markUnread not yet implemented. Remove \\Seen flag.');
  }

  async starEmail(messageId: string): Promise<void> {
    throw new Error('ImapProvider: starEmail not yet implemented. Set \\Flagged flag.');
  }

  async unstarEmail(messageId: string): Promise<void> {
    throw new Error('ImapProvider: unstarEmail not yet implemented. Remove \\Flagged flag.');
  }

  async trashEmail(messageId: string): Promise<void> {
    throw new Error('ImapProvider: trashEmail not yet implemented. Move to Trash mailbox.');
  }

  async searchEmails(query: string, maxResults = 20): Promise<{ id: string; threadId: string }[]> {
    throw new Error('ImapProvider: searchEmails not yet implemented. Use IMAP SEARCH command.');
  }
}
