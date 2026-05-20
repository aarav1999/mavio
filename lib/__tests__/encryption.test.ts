import { encrypt, decrypt } from '../encryption';

describe('Encryption', () => {
  const testKeyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeAll(() => {
    // Set test encryption key (64 hex characters = 32 bytes)
    process.env.ENCRYPTION_KEY = testKeyHex;
  });

  it('should encrypt and decrypt a string correctly', () => {
    const plaintext = 'test-password-123';
    const encrypted = encrypt(plaintext);
    
    expect(encrypted).toBeDefined();
    expect(encrypted.encrypted).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();
    
    const decrypted = decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext', () => {
    const plaintext = 'test-password-123';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    
    expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.tag).not.toBe(encrypted2.tag);
  });

  it('should fail to decrypt with wrong IV', () => {
    const plaintext = 'test-password-123';
    const encrypted = encrypt(plaintext);
    const wrongIv = Buffer.from('wrong-iv-12-bytes').toString('base64');
    
    expect(() => {
      decrypt(encrypted.encrypted, wrongIv, encrypted.tag);
    }).toThrow();
  });

  it('should fail to decrypt with wrong tag', () => {
    const plaintext = 'test-password-123';
    const encrypted = encrypt(plaintext);
    const wrongTag = Buffer.from('wrong-tag-16-bytes').toString('base64');
    
    expect(() => {
      decrypt(encrypted.encrypted, encrypted.iv, wrongTag);
    }).toThrow();
  });

  it('should handle empty strings', () => {
    const plaintext = '';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag);
    expect(decrypted).toBe(plaintext);
  });

  it('should handle special characters', () => {
    const plaintext = 'p@ssw0rd!#$%^&*()';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag);
    expect(decrypted).toBe(plaintext);
  });
});
