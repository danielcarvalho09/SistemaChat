import { describe, it, expect, beforeAll } from '@jest/globals';
import { encrypt, decrypt, isEncrypted, hash, generateEncryptionKey, testEncryption } from '../encryption';

describe('Encryption Utils', () => {
  describe('encrypt() and decrypt()', () => {
    it('should encrypt and decrypt text correctly', () => {
      const originalText = 'sensitive data 123';
      const encrypted = encrypt(originalText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(originalText);
    });

    it('should produce different ciphertext for same input (random IV)', () => {
      const text = 'same input';
      const encrypted1 = encrypt(text);
      const encrypted2 = encrypt(text);

      expect(encrypted1).not.toBe(encrypted2); // IVs diferentes
    });

    it('should throw error when encrypting empty string', () => {
      expect(() => encrypt('')).toThrow('Input must be a non-empty string');
    });

    it('should throw error when decrypting invalid format', () => {
      expect(() => decrypt('invalid')).toThrow('Invalid encrypted format');
    });

    it('should throw error when decrypting tampered data', () => {
      const encrypted = encrypt('test');
      const tampered = encrypted.replace(/.$/, 'x'); // Modificar último caractere

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should handle special characters', () => {
      const text = 'Special chars: 漢字, émojis 😀, symbols @#$%';
      const encrypted = encrypt(text);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(text);
    });

    it('should handle large text (10KB)', () => {
      const largeText = 'a'.repeat(10000);
      const encrypted = encrypt(largeText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(largeText);
    });
  });

  describe('isEncrypted()', () => {
    it('should return true for encrypted text', () => {
      const encrypted = encrypt('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isEncrypted('plain text')).toBe(false);
    });

    it('should return false for invalid format', () => {
      expect(isEncrypted('a:b')).toBe(false); // Menos de 3 partes
      expect(isEncrypted('a:b:c:d')).toBe(false); // Mais de 3 partes
      expect(isEncrypted('not:hex:string')).toBe(false); // Não é hex
    });

    it('should return false for null/undefined', () => {
      expect(isEncrypted(null as any)).toBe(false);
      expect(isEncrypted(undefined as any)).toBe(false);
    });
  });

  describe('hash()', () => {
    it('should produce consistent SHA-256 hash', () => {
      const text = 'test data';
      const hash1 = hash(text);
      const hash2 = hash(text);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hash('input1');
      const hash2 = hash('input2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateEncryptionKey()', () => {
    it('should generate 64-character hex key', () => {
      const key = generateEncryptionKey();
      
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/i.test(key)).toBe(true); // Hex válido
    });

    it('should generate different keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('testEncryption()', () => {
    it('should pass self-test', () => {
      expect(() => testEncryption()).not.toThrow();
      expect(testEncryption()).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should encrypt 1000 times in less than 1 second', () => {
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        encrypt('test data ' + i);
      }
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });

    it('should decrypt 1000 times in less than 1 second', () => {
      const encrypted = encrypt('test data');
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        decrypt(encrypted);
      }
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });
});

