import { StorageService } from './storage';
import { hashSHA256, deriveKey } from '../crypto/webcrypto';
import { UserProfile } from '../types';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Variáveis voláteis na memória RAM (nunca persistidas em disco)
let activeMasterKey: CryptoKey | null = null;
let activeSessionPassword: string | null = null; // Apenas se necessário para derivar outras chaves
let activeUserEmail: string | null = null; // E-mail da conta ativa na sessão

export const SessionService = {
  /**
   * Verifica se o usuário possui chave mestra ativa carregada na memória RAM.
   */
  isKeyLoaded(): boolean {
    return activeMasterKey !== null;
  },

  /**
   * Obtém a chave mestra ativa na memória RAM.
   * Dispara um erro caso a sessão esteja totalmente expirada, forçando login.
   */
  getMasterKey(): CryptoKey {
    if (!activeMasterKey) {
      throw new Error('Sessão expirada ou chave criptográfica não carregada na RAM.');
    }
    return activeMasterKey;
  },

  /**
   * Obtém o e-mail da conta ativa na RAM.
   */
  getActiveUserEmail(): string | null {
    return activeUserEmail;
  },

  /**
   * Define manualmente a chave mestra ativa na memória.
   */
  setMasterKey(key: CryptoKey): void {
    activeMasterKey = key;
  },

  /**
   * Limpa a chave mestra da RAM (Logoff total / Wipe de segurança).
   */
  clearSession(): void {
    activeMasterKey = null;
    activeSessionPassword = null;
    activeUserEmail = null;
  },

  /**
   * Executa a tentativa de autenticação com o e-mail e senha mestra.
   * Valida políticas de força bruta local antes de qualquer operação.
   */
  async authenticateMaster(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const emailKey = email.toLowerCase().trim();
    
    // 1. Verifica estado de bloqueio de força bruta
    const lockout = await this.checkLockout();
    if (lockout.isLocked) {
      return { success: false, error: lockout.message };
    }

    try {
      // 2. Autentica no Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, emailKey, password);
      const user = userCredential.user;

      // 3. Busca o perfil do usuário no Firestore usando o uid
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        return { success: false, error: 'Dados do perfil não encontrados no servidor.' };
      }
      
      const profileData = docSnap.data();

      // Reseta erros locais
      await this.resetFailedAttempts();
      
      // 4. Deriva e carrega a chave AES-256 de forma volátil na RAM
      activeMasterKey = await deriveKey(password, profileData.salt);
      activeSessionPassword = password;
      activeUserEmail = emailKey;
      
      // Adiciona o log de sucesso (isso usa auth.currentUser, que está definido)
      await StorageService.addAuditLog(emailKey, 'LOGIN_SUCCESS', 'Autenticação bem-sucedida via Senha Mestra.');

      return { success: true };
    } catch (err: any) {
      const attempts = await this.incrementFailedAttempts();
      const remaining = 3 - attempts;
      
      let errorMsg = 'E-mail ou Senha Mestra incorretos.';
      if (err.code === 'auth/user-not-found') {
        errorMsg = 'Usuário não cadastrado.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        errorMsg = `Senha mestra incorreta. Você tem mais ${remaining} tentativa(s) antes do bloqueio.`;
      }
      
      if (remaining <= 0) {
        return { 
          success: false, 
          error: 'Número de tentativas excedido. Aplicativo bloqueado temporariamente por 5 minutos.' 
        };
      } else {
        return { 
          success: false, 
          error: errorMsg 
        };
      }
    }
  },

  /**
   * Valida se a senha mestra segue a política rigorosa de segurança do TCC.
   */
  validatePasswordStrength(password: string): { isValid: boolean; feedback: string[] } {
    const feedback: string[] = [];
    if (password.length < 12) {
      feedback.push('A senha deve conter no mínimo 12 caracteres.');
    }
    if (!/[A-Z]/.test(password)) {
      feedback.push('A senha deve conter pelo menos uma letra maiúscula.');
    }
    if (!/[a-z]/.test(password)) {
      feedback.push('A senha deve conter pelo menos uma letra minúscula.');
    }
    if (!/[0-9]/.test(password)) {
      feedback.push('A senha deve conter pelo menos um número.');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      feedback.push('A senha deve conter pelo menos um caractere especial (!@#$...).');
    }

    return {
      isValid: feedback.length === 0,
      feedback
    };
  },

  /**
   * Registra um novo usuário com e-mail e senha no Firebase Auth e Firestore.
   */
  async registerUser(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const emailKey = email.toLowerCase().trim();

    const val = this.validatePasswordStrength(password);
    if (!val.isValid) {
      return { success: false, error: `Senha fraca: ${val.feedback.join(' ')}` };
    }

    try {
      // 1. Cria o usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, emailKey, password);
      const user = userCredential.user;

      // 2. Gera salt seguro e único para o usuário
      const salt = new Uint8Array(16);
      window.crypto.getRandomValues(salt);
      const saltBase64 = btoa(String.fromCharCode(...salt));

      // 3. Salva o perfil inicial do usuário no Firestore
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, {
        email: emailKey,
        salt: saltBase64,
        totpEnabled: false,
        encryptedVault: '',
        auditLogs: [],
        createdAt: new Date().toISOString()
      });

      // 4. Deriva a chave e carrega na RAM
      activeMasterKey = await deriveKey(password, saltBase64);
      activeSessionPassword = password;
      activeUserEmail = emailKey;

      await StorageService.addAuditLog(emailKey, 'LOGIN_SUCCESS', 'Perfil registrado com sucesso no Firebase.');

      return { success: true };
    } catch (err: any) {
      let errorMsg = 'Erro ao registrar no servidor.';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'Este e-mail já está cadastrado.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'E-mail inválido.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'A senha fornecida é muito fraca para o Firebase.';
      }
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Verifica se o dispositivo está atualmente bloqueado por força bruta.
   */
  async checkLockout(): Promise<{ isLocked: boolean; remainingSeconds: number; message?: string }> {
    const { attempts, lockoutUntil } = await StorageService.getLockoutState();
    
    if (lockoutUntil) {
      const now = Date.now();
      const lockTime = new Date(lockoutUntil).getTime();
      
      if (now < lockTime) {
        const remaining = Math.ceil((lockTime - now) / 1000);
        return {
          isLocked: true,
          remainingSeconds: remaining,
          message: `Defesa de Força Bruta Ativa: Tente novamente em ${remaining} segundos.`
        };
      } else {
        // O tempo de bloqueio expirou, reseta o estado
        await this.resetFailedAttempts();
      }
    }
    
    return { isLocked: false, remainingSeconds: 0 };
  },

  /**
   * Incrementa as tentativas incorretas e bloqueia se atingir 3 erros.
   */
  async incrementFailedAttempts(): Promise<number> {
    let { attempts } = await StorageService.getLockoutState();
    attempts += 1;
    
    let lockoutTime: string | null = null;
    if (attempts >= 3) {
      // Bloqueio de 5 minutos (300 segundos) para mitigar brute force local
      const date = new Date();
      date.setMinutes(date.getMinutes() + 5);
      lockoutTime = date.toISOString();
      const email = this.getActiveUserEmail() || '';
      await StorageService.addAuditLog(email, 'PIN_LOCKED', 'Aplicativo travado temporariamente após 3 falhas seguidas.');
    }

    await StorageService.saveLockoutState(attempts, lockoutTime);
    return attempts;
  },

  /**
   * Reseta o contador de erros locais.
   */
  async resetFailedAttempts(): Promise<void> {
    await StorageService.saveLockoutState(0, null);
  }
};
