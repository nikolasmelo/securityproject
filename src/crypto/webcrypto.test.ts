import { describe, it, expect } from 'vitest';
import { generateSalt, deriveKey, encryptData, decryptData, hashSHA256 } from './webcrypto';

describe('Web Crypto API Suite', () => {
  const password = 'Password@123456';

  it('deve gerar salts Base64 de comprimento válido', () => {
    const salt = generateSalt(16);
    expect(salt).toBeDefined();
    // Salt Base64 de 16 bytes possui comprimento aproximado de 24 caracteres devido a padding
    expect(salt.length).toBeGreaterThanOrEqual(20);
  });

  it('deve gerar hashes SHA-256 idênticos para a mesma entrada', async () => {
    const text = 'test_hash';
    const hash1 = await hashSHA256(text);
    const hash2 = await hashSHA256(text);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(text);
  });

  it('deve derivar chaves criptográficas consistentes', async () => {
    const salt = generateSalt(16);
    const key1 = await deriveKey(password, salt);
    const key2 = await deriveKey(password, salt);
    expect(key1).toBeDefined();
    expect(key2).toBeDefined();
    expect(key1.type).toBe('secret');
    expect(key1.algorithm.name).toBe('AES-GCM');
  });

  it('deve criptografar e decriptografar dados com sucesso', async () => {
    const secretMessage = 'Esta é uma credencial ultra secreta para o cofre.';
    const salt = generateSalt(16);
    const key = await deriveKey(password, salt);

    const encrypted = await encryptData(secretMessage, key);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(secretMessage);

    const decrypted = await decryptData(encrypted, key);
    expect(decrypted).toBe(secretMessage);
  });

  it('deve falhar ao decriptografar com chave errada', async () => {
    const secretMessage = 'Mensagem de teste';
    const salt = generateSalt(16);
    const correctKey = await deriveKey(password, salt);
    const wrongKey = await deriveKey('WrongPassword@12', salt);

    const encrypted = await encryptData(secretMessage, correctKey);

    await expect(decryptData(encrypted, wrongKey)).rejects.toThrow();
  });
});
