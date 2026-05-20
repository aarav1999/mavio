import { ProviderFactory } from '../factory';
import { decrypt } from '../../encryption';

// Mock the decrypt function
jest.mock('../../encryption');

describe('ProviderFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw error for unknown provider', () => {
    const account = {
      id: '1',
      provider: 'unknown',
      providerAccountId: 'test',
      email: 'test@example.com',
      imapHost: 'imap.example.com',
      imapPort: 993,
      smtpHost: 'smtp.example.com',
      smtpPort: 465,
      encryptedPassword: 'encrypted',
      encryptionIv: 'iv',
      encryptionTag: 'tag',
    };

    expect(() => ProviderFactory.create(account)).toThrow('Unsupported provider: unknown');
  });

  it('should decrypt password for IMAP provider', () => {
    (decrypt as jest.Mock).mockReturnValue('decrypted-password');

    const account = {
      id: '1',
      provider: 'imap',
      providerAccountId: 'test',
      email: 'test@example.com',
      imapHost: 'imap.example.com',
      imapPort: 993,
      smtpHost: 'smtp.example.com',
      smtpPort: 465,
      encryptedPassword: 'encrypted',
      encryptionIv: 'iv',
      encryptionTag: 'tag',
    };

    ProviderFactory.create(account);
    expect(decrypt).toHaveBeenCalledWith('encrypted', 'iv', 'tag');
  });

  it('should create IMAP provider with decrypted password', () => {
    (decrypt as jest.Mock).mockReturnValue('decrypted-password');

    const account = {
      id: '1',
      provider: 'imap',
      providerAccountId: 'test',
      email: 'test@example.com',
      imapHost: 'imap.example.com',
      imapPort: 993,
      smtpHost: 'smtp.example.com',
      smtpPort: 465,
      encryptedPassword: 'encrypted',
      encryptionIv: 'iv',
      encryptionTag: 'tag',
    };

    const provider = ProviderFactory.create(account);
    expect(provider).toBeDefined();
    expect(provider.constructor.name).toBe('ImapProvider');
  });

  it('should handle null encryptedPassword for OAuth providers', () => {
    const account = {
      id: '1',
      userId: 'user1',
      type: 'oauth',
      provider: 'google',
      providerAccountId: 'test',
      email: 'test@gmail.com',
      access_token: 'token',
      refresh_token: 'refresh',
      imapHost: null,
      imapPort: null,
      smtpHost: null,
      smtpPort: null,
      encryptedPassword: null,
      encryptionIv: null,
      encryptionTag: null,
    };

    expect(() => ProviderFactory.create(account)).not.toThrow();
  });
});
