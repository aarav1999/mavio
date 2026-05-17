import { ImapProvider, IMAPConfig } from '@/lib/providers/imap';
import { EmailProvider } from '@/lib/providers/interface';
import { IMAP_PRESETS, IMAPPresetKey } from '@/lib/imap-presets';

/**
 * ImapPlugin — wraps ImapProvider (imapflow + nodemailer + mailparser) with
 * plugin metadata and convenience constructors for common providers
 * (Yahoo, AOL, iCloud, custom).
 *
 * Implementation lives in `lib/providers/imap.ts`.
 */
export class ImapPlugin extends ImapProvider implements EmailProvider {
  readonly pluginName = 'ImapPlugin';
  readonly version = '1.0.0';
  readonly description =
    'Generic IMAP/SMTP provider for Yahoo, AOL, iCloud and custom servers';
  readonly status = 'implemented' as const;

  /** Build a configured IMAP plugin from a preset (yahoo / aol / icloud). */
  static fromPreset(
    preset: IMAPPresetKey,
    username: string,
    password: string,
  ): ImapPlugin {
    const cfg = IMAP_PRESETS[preset];
    return new ImapPlugin({
      username,
      password,
      host: cfg.imapHost,
      port: cfg.imapPort,
      smtpHost: cfg.smtpHost,
      smtpPort: cfg.smtpPort,
      secure: cfg.imapPort === 993,
    });
  }

  /** Build a configured IMAP plugin from a custom server config. */
  static fromCustom(config: IMAPConfig): ImapPlugin {
    return new ImapPlugin(config);
  }
}
