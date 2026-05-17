export interface IMAPPreset {
  name: string;
  imapHost: string;
  smtpHost: string;
  imapPort: number;
  smtpPort: number;
  secure: boolean;
  appPasswordUrl?: string;
}

export const IMAP_PRESETS: Record<string, IMAPPreset> = {
  gmail: {
    name: 'Gmail',
    imapHost: 'imap.gmail.com',
    smtpHost: 'smtp.gmail.com',
    imapPort: 993,
    smtpPort: 465,
    secure: true,
    appPasswordUrl: 'https://myaccount.google.com/apppasswords',
  },
  yahoo: {
    name: 'Yahoo Mail',
    imapHost: 'imap.mail.yahoo.com',
    smtpHost: 'smtp.mail.yahoo.com',
    imapPort: 993,
    smtpPort: 465,
    secure: true,
    appPasswordUrl: 'https://login.yahoo.com/account/security',
  },
  aol: {
    name: 'AOL Mail',
    imapHost: 'imap.aol.com',
    smtpHost: 'smtp.aol.com',
    imapPort: 993,
    smtpPort: 465,
    secure: true,
    appPasswordUrl: 'https://login.aol.com/account/security',
  },
  zoho: {
    name: 'Zoho Mail',
    imapHost: 'imap.zoho.com',
    smtpHost: 'smtp.zoho.com',
    imapPort: 993,
    smtpPort: 465,
    secure: true,
    appPasswordUrl: 'https://accounts.zoho.com/home#security/app_password',
  },
};

export type IMAPPresetKey = keyof typeof IMAP_PRESETS;
