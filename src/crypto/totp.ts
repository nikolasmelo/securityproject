/**
 * Implementação manual em TypeScript do protocolo TOTP (RFC 6238 / RFC 4226)
 * Utiliza a Web Crypto API nativa (HMAC-SHA1) para gerar chaves seguras locais.
 */

/**
 * Decodifica uma string Base32 para um Uint8Array (necessário para ler o segredo TOTP).
 */
export function decodeBase32(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) {
      throw new Error('Caractere Base32 inválido na chave secreta.');
    }
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substring(i * 8, (i + 1) * 8), 2);
  }
  return bytes;
}

/**
 * Gera um segredo aleatório codificado em Base32 de comprimento parametrizado.
 */
export function generateBase32Secret(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += alphabet[array[i] % alphabet.length];
  }
  return secret;
}

/**
 * Calcula o código TOTP de 6 dígitos a partir de um segredo Base32 e um tempo (timestamp).
 */
export async function generateTOTP(secretBase32: string, time = Date.now()): Promise<string> {
  const keyBytes = decodeBase32(secretBase32);
  
  // O passo do tempo padrão é de 30 segundos (RFC 6238)
  const epoch = Math.floor(time / 1000);
  const timeStep = Math.floor(epoch / 30);
  
  // Converte o timeStep em um buffer de 8 bytes big-endian
  const messageBytes = new Uint8Array(8);
  let temp = timeStep;
  for (let i = 7; i >= 0; i--) {
    messageBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  // 1. Importa os bytes da chave secreta
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes as any,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  // 2. Assina os bytes da mensagem (contador de tempo)
  const signatureBuffer = await window.crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    messageBytes as any
  );

  const hmacResult = new Uint8Array(signatureBuffer);

  // 3. Truncamento Dinâmico (Dynamic Truncation)
  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  // 4. Formata como número de 6 dígitos
  const otp = binary % 1000000;
  return String(otp).padStart(6, '0');
}

/**
 * Valida se um token fornecido pelo usuário corresponde ao segredo local.
 * Suporta uma janela de tolerância de tempo (ex: -1, 0, +1 passos de 30s)
 * para mitigar dessincronizações de relógio do celular do usuário.
 */
export async function verifyTOTP(
  token: string,
  secretBase32: string,
  windowTolerance = 1
): Promise<boolean> {
  const cleanToken = token.trim();
  if (cleanToken.length !== 6 || isNaN(Number(cleanToken))) {
    return false;
  }

  const now = Date.now();
  // Verifica o passo atual e passos vizinhos baseados na tolerância
  for (let i = -windowTolerance; i <= windowTolerance; i++) {
    const computed = await generateTOTP(secretBase32, now + i * 30 * 1000);
    if (computed === cleanToken) {
      return true;
    }
  }

  return false;
}
