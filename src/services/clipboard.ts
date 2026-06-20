import { Clipboard } from '@capacitor/clipboard';
import { StorageService } from './storage';
import { SessionService } from './session';

/**
 * Serviço centralizado de Hardening de Clipboard.
 * Implementa limpeza automática (Auto-Clear) de dados sensíveis
 * copiados para a área de transferência do dispositivo Android.
 */

let clearTimer: ReturnType<typeof setTimeout> | null = null;
let clipboardToastCallback: ((msg: string, timeLeft: number) => void) | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;

export const ClipboardService = {
  /**
   * Copia um texto sensível para o clipboard e agenda limpeza automática em 30s.
   */
  async copySecure(
    text: string,
    label: string,
    onStatus?: (msg: string, timeLeft: number) => void
  ): Promise<void> {
    // Cancela qualquer timer anterior
    this.cancelClear();

    await Clipboard.write({ string: text });
    const email = SessionService.getActiveUserEmail() || '';
    await StorageService.addAuditLog(email, 'PASSWORD_COPIED', `${label} copiado. Auto-Clear em 30s.`);

    clipboardToastCallback = onStatus ?? null;

    let timeLeft = 30;
    if (onStatus) onStatus(`${label} copiado! Limpando em ${timeLeft}s...`, timeLeft);

    countdownInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0 && clipboardToastCallback) {
        clipboardToastCallback(`Clipboard limpo em ${timeLeft}s`, timeLeft);
      }
    }, 1000);

    clearTimer = setTimeout(async () => {
      try {
        const current = await Clipboard.read();
        if (current.value === text) {
          await Clipboard.write({ string: '' });
          const email = SessionService.getActiveUserEmail() || '';
          await StorageService.addAuditLog(email, 'PASSWORD_COPIED', 'Clipboard limpo automaticamente após 30s (Hardening).');
          if (clipboardToastCallback) {
            clipboardToastCallback('Clipboard limpo por segurança ✓', 0);
          }
        }
      } catch {
        // Silencioso: se não conseguir ler o clipboard, não há problema
      } finally {
        this.cancelClear();
      }
    }, 30000);
  },

  /**
   * Cancela o timer de limpeza automática (ex: usuário saiu da tela).
   */
  cancelClear(): void {
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    clipboardToastCallback = null;
  },

  /**
   * Limpa o clipboard imediatamente, sem esperar o timer.
   */
  async clearNow(): Promise<void> {
    this.cancelClear();
    await Clipboard.write({ string: '' });
    const email = SessionService.getActiveUserEmail() || '';
    await StorageService.addAuditLog(email, 'PASSWORD_COPIED', 'Clipboard limpo manualmente pelo usuário.');
  },
};
