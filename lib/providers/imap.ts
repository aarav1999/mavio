import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { EmailProvider, ListOptions, ThreadList, SendOptions } from './interface';

/**
 * ImapProvider — MVP IMAP/SMTP provider using imapflow + nodemailer + mailparser.
 *
 * Scope:
 *  - listThreads: envelope-only (no body, no parser) for fast initial sync
 *  - getThread: full source + simpleParser, on-demand
 *  - send via SMTP (nodemailer)
 *  - markRead / markUnread via \Seen flag
 *  - archive / star / trash / search: NOT implemented at provider layer
 *    (handled DB-side; folder names vary across providers, MVP keeps it stable)
 */

export interface IMAPConfig {
  username: string;
  password: string;
  host: string;
  port: number;
  smtpHost: string;
  smtpPort: number;
  secure?: boolean;
}

export interface IMAPEnvelopeThread {
  id: string; // UID as string
  historyId?: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  snippet: string;
  receivedAt: Date;
  isRead: boolean;
  isStarred: boolean;
}

export class ImapProvider implements EmailProvider {
  private config: IMAPConfig;
  private client: ImapFlow | null = null;

  constructor(config: IMAPConfig) {
    this.config = config;
  }

  private currentFolder: string | null = null;

  private async getConnection(folder: string = 'INBOX'): Promise<ImapFlow> {
    // Reuse connection if already connected to the same folder
    if (this.client && this.client.usable && this.currentFolder === folder) {
      return this.client;
    }

    // Disconnect if switching to a different folder
    if (this.client) {
      try {
        await this.client.logout();
      } catch {
        // ignore
      }
      this.client = null;
      this.currentFolder = null;
    }

    const client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure ?? this.config.port === 993,
      auth: {
        user: this.config.username,
        pass: this.config.password,
      },
      logger: false,
    });

    await client.connect();
    try {
      await client.mailboxOpen(folder);
      this.currentFolder = folder;
    } catch (err: any) {
      console.error(`[ImapProvider] Failed to open folder ${folder}:`, err.message);
      await client.logout();
      this.client = null;
      this.currentFolder = null;
      throw err;
    }
    this.client = client;
    return client;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch {
        // ignore
      }
      this.client = null;
    }
  }

  async listFolders(): Promise<string[]> {
    try {
      const client = await this.getConnection();
      const tree = await client.list();
      const folders: string[] = [];
      
      for (const node of tree) {
        if (node.path) {
          folders.push(node.path);
        }
      }
      
      return folders;
    } catch (err) {
      console.error('[ImapProvider] Failed to list folders:', err);
      return [];
    }
  }

  /**
   * Envelope-only listing. Returns ThreadList for interface compatibility,
   * but each thread is enriched with envelope fields so the caller can
   * persist metadata without a second round-trip.
   */
  async listThreads(_accessToken: string, opts?: ListOptions): Promise<ThreadList & { enriched: IMAPEnvelopeThread[] }> {
    const folder = opts?.folder || 'INBOX';
    const client = await this.getConnection(folder);
    const maxResults = opts?.maxResults ?? 20;

    // Get all UIDs, then take the most recent maxResults
    const allUids = (await client.search({ all: true }, { uid: true })) || [];
    const uids = allUids.slice(-maxResults).reverse();

    if (uids.length === 0) {
      return { threads: [], enriched: [] };
    }

    const enriched: IMAPEnvelopeThread[] = [];

    for await (const msg of client.fetch(
      uids,
      { envelope: true, flags: true, internalDate: true },
      { uid: true }
    )) {
      const env = msg.envelope;
      const fromAddr = env?.from?.[0];
      const toAddr = env?.to?.[0];
      const flags = msg.flags ?? new Set<string>();

      enriched.push({
        id: msg.uid.toString(),
        historyId: msg.uid.toString(),
        subject: env?.subject || '(no subject)',
        fromName: fromAddr?.name || '',
        fromEmail: fromAddr?.address || '',
        toEmail: toAddr?.address || this.config.username,
        snippet: env?.subject || '',
        receivedAt: env?.date
          ? new Date(env.date)
          : msg.internalDate
            ? new Date(msg.internalDate as any)
            : new Date(),
        isRead: flags.has('\\Seen'),
        isStarred: flags.has('\\Flagged'),
      });
    }

    // imapflow yields in UID order; we asked for newest-first slice but
    // iteration order isn't guaranteed reversed, so sort here.
    enriched.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

    return {
      threads: enriched.map((e) => ({ id: e.id, historyId: e.historyId })),
      enriched,
    };
  }

  /**
   * Fetch full message source by UID, parse with mailparser, return normalized.
   */
  async getThread(_accessToken: string, uid: string, folder?: string): Promise<any> {
    const client = await this.getConnection(folder || 'INBOX');
    const uids = await client.search({ all: true }, { uid: true });
    const uidNum = parseInt(uid, 10);
    
    // @ts-ignore - uids can be false or array
    const uidArray = Array.isArray(uids) ? uids : [];
    const found = uidArray.includes(uidNum);
    if (!found) {
      throw new Error(`IMAP message UID ${uid} not found`);
    }

    const messages = await client.fetch(uidNum, { source: true }, { uid: true });
    let msgSource = '';
    for await (const msg of messages) {
      // @ts-ignore - msg.source might be Buffer
      msgSource = msg.source?.toString() || '';
      break;
    }

    if (!msgSource) {
      throw new Error('No message source found');
    }

    const parsed = await simpleParser(msgSource);
    const threadId = uid;

    const body = parsed.html || parsed.text || '';
    const textSnippet = body.replace(/\s+/g, ' ').trim().slice(0, 200);

    // Handle address parsing with proper type checking
    const fromAddress = parsed.from;
    const toAddress = parsed.to;
    
    let fromName = '';
    let fromEmail = '';
    let toEmail = '';

    if (fromAddress) {
      if (Array.isArray(fromAddress)) {
        // @ts-ignore - mailparser types are not accurate
        fromName = fromAddress[0]?.name || '';
        // @ts-ignore - mailparser types are not accurate
        fromEmail = fromAddress[0]?.address || '';
      } else {
        // @ts-ignore - mailparser types are not accurate
        fromName = fromAddress.name || '';
        // @ts-ignore - mailparser types are not accurate
        fromEmail = fromAddress.address || '';
      }
    }

    if (toAddress) {
      if (Array.isArray(toAddress)) {
        // @ts-ignore - mailparser types are not accurate
        toEmail = toAddress[0]?.address || this.config.username;
      } else {
        // @ts-ignore - mailparser types are not accurate
        toEmail = toAddress.address || this.config.username;
      }
    }

    return {
      id: threadId,
      threadId,
      subject: parsed.subject || '(no subject)',
      fromName,
      fromEmail,
      toEmail,
      body,
      snippet: textSnippet,
      receivedAt: parsed.date || new Date(),
      isRead: false,
      isStarred: false,
      labels: [],
    };
  }

  async sendEmail(_accessToken: string, opts: SendOptions): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpPort === 465,
      auth: {
        user: this.config.username,
        pass: this.config.password,
      },
    });

    await transporter.sendMail({
      from: this.config.username,
      to: opts.to,
      subject: opts.subject,
      html: opts.body,
      inReplyTo: opts.inReplyTo,
      references: opts.inReplyTo,
    });
  }

  async markRead(_accessToken: string, messageId: string): Promise<void> {
    const client = await this.getConnection();
    const uid = parseInt(messageId, 10);
    await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
  }

  async markUnread(_accessToken: string, messageId: string): Promise<void> {
    const client = await this.getConnection();
    const uid = parseInt(messageId, 10);
    await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
  }

  // MVP: archive is a DB-side concept for IMAP (folder names vary too much).
  async archiveEmail(_accessToken: string, _messageId: string): Promise<void> {
    throw new Error('IMAP archive is handled DB-side in MVP.');
  }

  // MVP: skip star/unstar from the IMAP layer.
  async starEmail(_accessToken: string, _messageId: string): Promise<void> {
    throw new Error('IMAP star/unstar not implemented in MVP.');
  }

  async unstarEmail(_accessToken: string, _messageId: string): Promise<void> {
    throw new Error('IMAP star/unstar not implemented in MVP.');
  }

  // MVP: trash handled DB-side (soft archive) to avoid folder-naming inconsistency.
  async trashEmail(_accessToken: string, _messageId: string): Promise<void> {
    throw new Error('IMAP trash is handled DB-side in MVP.');
  }

  // MVP: search is performed on the normalized DB for unified behavior.
  async searchEmails(): Promise<{ id: string; threadId: string }[]> {
    throw new Error('IMAP search is performed against the normalized DB.');
  }
}
