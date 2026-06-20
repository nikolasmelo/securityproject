/**
 * Estrutura para dados criptografados localmente.
 * Armazena o ciphertext codificado e metadados necessários para a decriptação.
 */
export interface EncryptedData {
  ciphertext: string; // Conteúdo criptografado em formato Base64 ou Hex
  iv: string;         // Vetor de Inicialização em Base64 ou Hex
}

/**
 * Histórico de alterações de uma credencial para fins de auditoria local.
 */
export interface PasswordHistoryItem {
  id: string;
  username: string;
  encryptedPassword: EncryptedData;
  updatedAt: string;
}

/**
 * Item de credencial armazenado no cofre (Vault).
 */
export interface VaultItem {
  id: string;
  title: string;
  username: string;
  encryptedPassword: EncryptedData;
  url: string;
  encryptedNotes?: EncryptedData;
  updatedAt: string;
  history?: PasswordHistoryItem[];
}

/**
 * Perfil do usuário com dados de segurança para autenticação local e 2FA.
 */
export interface UserProfile {
  username: string;
  salt: string;              // Salt gerado aleatoriamente para derivação da chave mestra
  passwordHash: string;      // Hash SHA-256 da senha mestra + salt para verificação rápida de login
  pinHash?: string;          // Hash do PIN local de 6 dígitos para re-entrada rápida
  totpSecret?: string;       // Mantido temporariamente para compatibilidade legada
  encryptedTotpSecret?: EncryptedData; // Segredo TOTP criptografado com a Master Key
  totpEnabled: boolean;      // Indica se o 2FA está configurado e ativado
  createdAt: string;
}

/**
 * Sessão de login local ativa no dispositivo móvel.
 */
export interface ActiveSession {
  id: string;
  deviceName: string;
  lastActive: string;
  ipPlaceholder?: string;
}

/**
 * Registros de eventos de segurança (Audit Logs) para visualização do usuário.
 */
export interface AuditLog {
  id: string;
  timestamp: string;
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | '2FA_VERIFIED' | 'PIN_LOCKED' | 'CREDENTIAL_CREATED' | 'CREDENTIAL_UPDATED' | 'CREDENTIAL_DELETED' | 'PASSWORD_COPIED' | 'BACKUP_EXPORTED' | 'SCREENSHOT_BLOCKED' | 'AUTO_LOCK' | 'LOGOUT';
  details: string;
}
