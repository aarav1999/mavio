import { EmailProvider, ListOptions, ThreadList, SendOptions } from './interface';

/**
 * OutlookProvider — scaffold stub
 *
 * Integration path:
 * - OAuth: NextAuth Microsoft provider (azure-ad or microsoft-entra-id)
 * - API: Microsoft Graph API (https://graph.microsoft.com/v1.0/me/messages)
 * - Scopes: Mail.Read, Mail.Send, Mail.ReadWrite
 * - SDK: @microsoft/microsoft-graph-client
 *
 * This stub satisfies the EmailProvider interface.
 * Wire up MS Graph calls where indicated to complete implementation.
 */
export class OutlookProvider implements EmailProvider {
  constructor(private accessToken: string) {}

  async listThreads(opts?: ListOptions): Promise<ThreadList> {
    throw new Error('OutlookProvider: listThreads not yet implemented. Use MS Graph /me/mailFolders/inbox/messages');
  }

  async getThread(threadId: string): Promise<any> {
    throw new Error('OutlookProvider: getThread not yet implemented. Use MS Graph /me/messages/{id}');
  }

  async sendEmail(opts: SendOptions): Promise<void> {
    throw new Error('OutlookProvider: sendEmail not yet implemented. Use MS Graph /me/sendMail');
  }

  async archiveEmail(messageId: string): Promise<void> {
    throw new Error('OutlookProvider: archiveEmail not yet implemented. Move to Archive folder via MS Graph');
  }

  async markRead(messageId: string): Promise<void> {
    throw new Error('OutlookProvider: markRead not yet implemented. PATCH /me/messages/{id} { isRead: true }');
  }

  async markUnread(messageId: string): Promise<void> {
    throw new Error('OutlookProvider: markUnread not yet implemented. PATCH /me/messages/{id} { isRead: false }');
  }

  async starEmail(messageId: string): Promise<void> {
    throw new Error('OutlookProvider: starEmail not yet implemented. Use flag in MS Graph');
  }

  async unstarEmail(messageId: string): Promise<void> {
    throw new Error('OutlookProvider: unstarEmail not yet implemented.');
  }

  async trashEmail(messageId: string): Promise<void> {
    throw new Error('OutlookProvider: trashEmail not yet implemented. DELETE /me/messages/{id}');
  }

  async searchEmails(query: string, maxResults = 20): Promise<{ id: string; threadId: string }[]> {
    throw new Error('OutlookProvider: searchEmails not yet implemented. Use MS Graph /me/messages?$search="{query}"');
  }
}
