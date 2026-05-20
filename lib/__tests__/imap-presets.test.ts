import { IMAP_PRESETS } from '../imap-presets';

describe('IMAP Presets', () => {
  it('should have gmail preset with correct values', () => {
    const gmail = IMAP_PRESETS.gmail;
    expect(gmail).toBeDefined();
    expect(gmail.imapHost).toBe('imap.gmail.com');
    expect(gmail.imapPort).toBe(993);
    expect(gmail.smtpHost).toBe('smtp.gmail.com');
    expect(gmail.smtpPort).toBe(465);
  });

  it('should have yahoo preset with correct values', () => {
    const yahoo = IMAP_PRESETS.yahoo;
    expect(yahoo).toBeDefined();
    expect(yahoo.imapHost).toBe('imap.mail.yahoo.com');
    expect(yahoo.imapPort).toBe(993);
    expect(yahoo.smtpHost).toBe('smtp.mail.yahoo.com');
    expect(yahoo.smtpPort).toBe(465);
  });

  it('should have aol preset with correct values', () => {
    const aol = IMAP_PRESETS.aol;
    expect(aol).toBeDefined();
    expect(aol.imapHost).toBe('imap.aol.com');
    expect(aol.imapPort).toBe(993);
    expect(aol.smtpHost).toBe('smtp.aol.com');
    expect(aol.smtpPort).toBe(465);
  });

  it('should have zoho preset with correct values', () => {
    const zoho = IMAP_PRESETS.zoho;
    expect(zoho).toBeDefined();
    expect(zoho.imapHost).toBe('imap.zoho.com');
    expect(zoho.imapPort).toBe(993);
    expect(zoho.smtpHost).toBe('smtp.zoho.com');
    expect(zoho.smtpPort).toBe(465);
  });

  it('should have all required preset keys', () => {
    const requiredKeys = ['gmail', 'yahoo', 'aol', 'zoho'];
    requiredKeys.forEach(key => {
      expect(IMAP_PRESETS[key]).toBeDefined();
    });
  });

  it('should have valid port numbers for all presets', () => {
    Object.values(IMAP_PRESETS).forEach(preset => {
      expect(typeof preset.imapPort).toBe('number');
      expect(typeof preset.smtpPort).toBe('number');
      expect(preset.imapPort).toBeGreaterThan(0);
      expect(preset.smtpPort).toBeGreaterThan(0);
      expect(preset.imapPort).toBeLessThanOrEqual(65535);
      expect(preset.smtpPort).toBeLessThanOrEqual(65535);
    });
  });

  it('should have non-empty host strings for all presets', () => {
    Object.values(IMAP_PRESETS).forEach(preset => {
      expect(typeof preset.imapHost).toBe('string');
      expect(typeof preset.smtpHost).toBe('string');
      expect(preset.imapHost.length).toBeGreaterThan(0);
      expect(preset.smtpHost.length).toBeGreaterThan(0);
    });
  });
});
