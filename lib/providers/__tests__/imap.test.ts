import { ImapProvider } from '../imap';

// Mock imapflow and nodemailer
jest.mock('imapflow', () => ({
  ImapFlow: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    fetch: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('nodemailer', () => ({
  default: {
    createTransport: jest.fn().mockReturnValue({
      verify: jest.fn().mockResolvedValue(true),
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    }),
  },
}));

jest.mock('mailparser', () => ({
  simpleParser: jest.fn().mockResolvedValue({
    subject: 'Test',
    from: { value: [{ address: 'test@example.com', name: 'Test' }] },
    to: { value: [{ address: 'to@example.com' }] },
    text: 'Test body',
    date: new Date(),
  }),
}));

describe('ImapProvider', () => {
  const config = {
    username: 'test@example.com',
    password: 'decrypted-password',
    host: 'imap.example.com',
    port: 993,
    smtpHost: 'smtp.example.com',
    smtpPort: 465,
  };

  it('should instantiate with correct config', () => {
    const provider = new ImapProvider(config);
    expect(provider).toBeDefined();
  });

  it('should have listThreads method', () => {
    const provider = new ImapProvider(config);
    expect(typeof provider.listThreads).toBe('function');
  });

  it('should have getThread method', () => {
    const provider = new ImapProvider(config);
    expect(typeof provider.getThread).toBe('function');
  });

  it('should have sendEmail method', () => {
    const provider = new ImapProvider(config);
    expect(typeof provider.sendEmail).toBe('function');
  });

  it('should have markRead method', () => {
    const provider = new ImapProvider(config);
    expect(typeof provider.markRead).toBe('function');
  });

  it('should have markUnread method', () => {
    const provider = new ImapProvider(config);
    expect(typeof provider.markUnread).toBe('function');
  });

  it('should not have archive method (handled at DB level)', () => {
    const provider = new ImapProvider(config);
    expect(typeof (provider as any).archive).toBe('undefined');
  });

  it('should not have star method (handled at DB level)', () => {
    const provider = new ImapProvider(config);
    expect(typeof (provider as any).star).toBe('undefined');
  });

  it('should not have trash method (handled at DB level)', () => {
    const provider = new ImapProvider(config);
    expect(typeof (provider as any).trash).toBe('undefined');
  });

  it('should not have search method (handled at DB level)', () => {
    const provider = new ImapProvider(config);
    expect(typeof (provider as any).search).toBe('undefined');
  });
});
