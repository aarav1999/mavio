import { EmailProvider, ListOptions, ThreadList, SendOptions } from './interface';

interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
    };
  }>;
  body: {
    content: string;
    contentType: string;
  };
  bodyPreview: string;
  receivedDateTime: string;
  isRead: boolean;
  flag?: {
    flagStatus: string;
  };
}

interface GraphResponse {
  value: GraphMessage[];
  '@odata.nextLink'?: string;
}

/**
 * OutlookProvider — Microsoft Graph API integration
 *
 * Uses Microsoft Graph API to access Outlook/Office 365 emails
 * API: https://graph.microsoft.com/v1.0/me/messages
 * Scopes: Mail.Read, Mail.Send, Mail.ReadWrite
 */
export class OutlookProvider implements EmailProvider {
  private getHeaders(accessToken: string): HeadersInit {
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async listThreads(accessToken: string, opts?: ListOptions): Promise<ThreadList> {
    const maxResults = opts?.maxResults || 20;
    const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=${maxResults}&$orderby=receivedDateTime desc&$select=id,conversationId,subject,from,toRecipients,body,bodyPreview,receivedDateTime,isRead,flag`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(accessToken),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Outlook API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: GraphResponse = await response.json();

    const threads = data.value.map((msg) => ({
      id: msg.id, // Use message ID instead of conversation ID for fetching
      historyId: msg.id,
      conversationId: msg.conversationId, // Store conversation ID separately
    }));

    return { threads, nextPageToken: data['@odata.nextLink'] };
  }

  async getThread(accessToken: string, threadId: string): Promise<any> {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${threadId}?$expand=attachments`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(accessToken),
    });

    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.status} ${response.statusText}`);
    }

    const msg: GraphMessage = await response.json();

    return {
      id: msg.id,
      threadId: msg.conversationId,
      subject: msg.subject,
      fromName: msg.from.emailAddress.name,
      fromEmail: msg.from.emailAddress.address,
      toEmail: msg.toRecipients[0]?.emailAddress.address || '',
      body: msg.body.content,
      snippet: msg.bodyPreview,
      receivedAt: new Date(msg.receivedDateTime),
      isRead: msg.isRead,
      isStarred: msg.flag?.flagStatus === 'flagged',
      labels: [],
    };
  }

  async sendEmail(accessToken: string, opts: SendOptions): Promise<void> {
    const url = 'https://graph.microsoft.com/v1.0/me/sendMail';
    
    const message = {
      message: {
        subject: opts.subject,
        body: {
          contentType: 'Text',
          content: opts.body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: opts.to,
            },
          },
        ],
        ...(opts.inReplyTo && {
          conversationId: opts.inReplyTo,
        }),
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.status} ${response.statusText}`);
    }
  }

  async archiveEmail(accessToken: string, messageId: string): Promise<void> {
    // First, get the Archive folder ID
    const foldersUrl = 'https://graph.microsoft.com/v1.0/me/mailFolders?$filter=displayName eq \'Archive\'';
    const foldersResponse = await fetch(foldersUrl, {
      headers: this.getHeaders(accessToken),
    });

    if (!foldersResponse.ok) {
      throw new Error(`Outlook API error: ${foldersResponse.status} ${foldersResponse.statusText}`);
    }

    const foldersData = await foldersResponse.json();
    const archiveFolderId = foldersData.value?.[0]?.id;

    if (!archiveFolderId) {
      throw new Error('Archive folder not found');
    }

    // Move the message to Archive
    const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}/move`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        destinationId: archiveFolderId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.status} ${response.statusText}`);
    }
  }

  async markRead(accessToken: string, messageId: string): Promise<void> {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        isRead: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.status} ${response.statusText}`);
    }
  }

  async markUnread(accessToken: string, messageId: string): Promise<void> {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        isRead: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.status} ${response.statusText}`);
    }
  }

  async starEmail(accessToken: string, messageId: string): Promise<void> {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        flag: {
          flagStatus: 'flagged',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.status} ${response.statusText}`);
    }
  }

  async unstarEmail(accessToken: string, messageId: string): Promise<void> {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.getHeaders(accessToken),
      body: JSON.stringify({
        flag: {
          flagStatus: 'notFlagged',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.status} ${response.statusText}`);
    }
  }

  async trashEmail(accessToken: string, messageId: string): Promise<void> {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(accessToken),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Outlook API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
  }

  async searchEmails(accessToken: string, query: string, maxResults = 20): Promise<{ id: string; threadId: string }[]> {
    const url = `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(query)}"&$top=${maxResults}&$select=id,conversationId`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(accessToken),
    });

    if (!response.ok) {
      throw new Error(`Outlook API error: ${response.status} ${response.statusText}`);
    }

    const data: GraphResponse = await response.json();

    return data.value.map((msg) => ({
      id: msg.id,
      threadId: msg.conversationId,
    }));
  }
}
