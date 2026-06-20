import { EncryptedData } from '../types';

/**
 * Utilitários auxiliares de conversão de dados
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Gera um salt criptograficamente seguro e retorna como string Base64.
 */
export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return arrayBufferToBase64(array.buffer);
}

/**
 * Deriva uma CryptoKey AES-256 a partir de uma senha e um salt usando PBKDF2-HMAC-SHA256.
 * Utiliza 100.000 iterações, atendendo aos padrões rígidos de TCC e segurança.
 */
export async function deriveKey(password: string, saltBase64: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = base64ToArrayBuffer(saltBase64);

  // 1. Importa a senha em formato bruto
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // 2. Deriva a chave AES de 256 bits
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 600000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // Chave não exportável por segurança na memória RAM
    ['encrypt', 'decrypt']
  );
}

/**
 * Criptografa uma string usando AES-256-GCM com a CryptoKey derivada.
 */
export async function encryptData(plaintext: string, key: CryptoKey): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // IV de 12 bytes recomendado para o modo AES-GCM
  const ivBytes = new Uint8Array(12);
  window.crypto.getRandomValues(ivBytes);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    key,
    plaintextBytes
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(ivBytes.buffer)
  };
}

/**
 * Decriptografa dados usando AES-256-GCM com a CryptoKey derivada.
 */
export async function decryptData(encryptedData: EncryptedData, key: CryptoKey): Promise<string> {
  const ciphertextBytes = base64ToArrayBuffer(encryptedData.ciphertext);
  const ivBytes = base64ToArrayBuffer(encryptedData.iv);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    key,
    ciphertextBytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Gera um Hash SHA-256 (Base64) de um texto. Utilizado para verificar senhas/PINs localmente
 * sem expor as strings originais em disco.
 */
export async function hashSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64(hashBuffer);
}
