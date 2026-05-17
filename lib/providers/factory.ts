import type { Account } from '@prisma/client';
import { EmailProvider } from './interface';
import { gmailPlugin } from '@/plugins/gmail-plugin';
import { OutlookProvider } from './outlook';
import { ImapProvider } from './imap';
import { decrypt } from '@/lib/encryption';

/**
 * ProviderFactory — single integration point for all email providers.
 *
 * Provider ids match the NextAuth account.provider values:
 *  - 'google'    → Gmail (existing plugin singleton)
 *  - 'azure-ad'  → Outlook / Office 365 (Microsoft Graph)
 *  - 'imap'      → Generic IMAP/SMTP (Yahoo, AOL, Zoho, custom)
 */
export class ProviderFactory {
  static create(account: Pick<
    Account,
    | 'provider'
    | 'email'
    | 'imapHost'
    | 'imapPort'
    | 'smtpHost'
    | 'smtpPort'
    | 'encryptedPassword'
    | 'encryptionIv'
    | 'encryptionTag'
  >): EmailProvider {
    switch (account.provider) {
      case 'google':
        return gmailPlugin;

      case 'azure-ad':
        return new OutlookProvider();

      case 'imap': {
        if (
          !account.email ||
          !account.imapHost ||
          !account.imapPort ||
          !account.smtpHost ||
          !account.smtpPort ||
          !account.encryptedPassword ||
          !account.encryptionIv ||
          !account.encryptionTag
        ) {
          throw new Error('IMAP account is missing required credentials/config');
        }
        const password = decrypt(
          account.encryptedPassword,
          account.encryptionIv,
          account.encryptionTag
        );
        return new ImapProvider({
          username: account.email,
          password,
          host: account.imapHost,
          port: account.imapPort,
          smtpHost: account.smtpHost,
          smtpPort: account.smtpPort,
          secure: true,
        });
      }

      default:
        throw new Error(`Unsupported provider: ${account.provider}`);
    }
  }
}
