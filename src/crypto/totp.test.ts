import { describe, it, expect } from 'vitest';
import { generateBase32Secret, generateTOTP, verifyTOTP } from './totp';

describe('TOTP Algorithm Suite', () => {
  const testSecret = 'JBSWY3DPEHPK3PXP'; // "hello" em Base32

  it('deve gerar segredos Base32 válidos', () => {
    const secret = generateBase32Secret(16);
    expect(secret).toHaveLength(16);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('deve gerar tokens de 6 dígitos numéricos', async () => {
    const token = await generateTOTP(testSecret);
    expect(token).toHaveLength(6);
    expect(Number(token)).not.toBeNaN();
  });

  it('deve validar tokens com janela de tolerância correta', async () => {
    const token = await generateTOTP(testSecret);
    const isValid = await verifyTOTP(token, testSecret, 1);
    expect(isValid).toBe(true);
  });

  it('deve rejeitar tokens incorretos', async () => {
    const invalidToken = '000000';
    const isValid = await verifyTOTP(invalidToken, testSecret, 1);
    expect(isValid).toBe(false);
  });

  it('deve validar tokens com leve diferença de tempo (simulando drift do celular)', async () => {
    const now = Date.now();
    // Gera token para 15 segundos no futuro
    const futureToken = await generateTOTP(testSecret, now + 15000);
    // Verifica agora com tolerância de 1 passo (30s)
    const isValid = await verifyTOTP(futureToken, testSecret, 1);
    expect(isValid).toBe(true);
  });
});
