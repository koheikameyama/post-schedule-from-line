import { encrypt, decrypt } from '../encryption';

describe('Encryption', () => {
  const testData = 'sensitive-token-data';

  it('should encrypt and decrypt data correctly', () => {
    const encrypted = encrypt(testData);
    expect(encrypted).not.toBe(testData);
    expect(encrypted).toContain(':'); // IV separator

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(testData);
  });

  it('should produce different encrypted values for same input', () => {
    const encrypted1 = encrypt(testData);
    const encrypted2 = encrypt(testData);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should throw error if encryption key is not set', () => {
    const originalKey = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;

    expect(() => encrypt(testData)).toThrow('ENCRYPTION_KEY is not set');

    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('should throw error if encryption key has invalid length', () => {
    const originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = '0'.repeat(63); // 31.5 bytes, invalid

    expect(() => encrypt('test')).toThrow('must be 32 bytes');

    process.env.ENCRYPTION_KEY = originalKey;
  });
});
