import { StorageService } from './storage';
import { SessionService } from './session';
import { encryptData, decryptData, deriveKey } from '../crypto/webcrypto';
import { VaultItem, PasswordHistoryItem, EncryptedData } from '../types';

const VAULT_KEY = 'zk_vault_v2';

// ==========================================
// Helpers de conversão
// ==========================================
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// ==========================================
// Estrutura persistida (apenas ciphertext)
// ==========================================
interface StoredVault {
  items: StoredVaultItem[];
}

interface StoredVaultItem {
  id: string;
  title: string;           // título em claro (metadado não sensível)
  encryptedUsername: EncryptedData;
  encryptedPassword: EncryptedData;
  url: string;             // URL em claro (metadado não sensível)
  encryptedNotes?: EncryptedData;
  updatedAt: string;
  history: StoredHistoryItem[];
}

interface StoredHistoryItem {
  id: string;
  encryptedUsername: EncryptedData;
  encryptedPassword: EncryptedData;
  updatedAt: string;
}

// ==========================================
// Carrega e salva vault criptografado
// ==========================================
async function loadStoredVault(): Promise<StoredVault> {
  const email = SessionService.getActiveUserEmail();
  if (!email) return { items: [] };
  const raw = await StorageService.getEncryptedVault(email);
  if (!raw) return { items: [] };
  try {
    return JSON.parse(raw) as StoredVault;
  } catch {
    return { items: [] };
  }
}

async function saveStoredVault(vault: StoredVault): Promise<void> {
  const email = SessionService.getActiveUserEmail();
  if (!email) return;
  await StorageService.saveEncryptedVault(email, JSON.stringify(vault));
}

// ==========================================
// Decriptografa um item armazenado
// ==========================================
async function decryptItem(stored: StoredVaultItem): Promise<VaultItem> {
  const key = SessionService.getMasterKey();
  const username = await decryptData(stored.encryptedUsername, key);
  const password = await decryptData(stored.encryptedPassword, key);
  const notes = stored.encryptedNotes
    ? await decryptData(stored.encryptedNotes, key)
    : undefined;

  const history: PasswordHistoryItem[] = await Promise.all(
    stored.history.map(async (h) => ({
      id: h.id,
      username: await decryptData(h.encryptedUsername, key),
      encryptedPassword: h.encryptedPassword, // mantém criptografado; decripta só quando exibir
      updatedAt: h.updatedAt,
    }))
  );

  return {
    id: stored.id,
    title: stored.title,
    username,
    encryptedPassword: stored.encryptedPassword, // referência para auditoria
    url: stored.url,
    updatedAt: stored.updatedAt,
    history,
    encryptedNotes: stored.encryptedNotes,
    // password em texto claro NÃO fica na estrutura VaultItem — apenas derivado quando necessário
    _plaintextPassword: password,  // campo temporário em memória
  } as any;
}

// ==========================================
// VaultService — API pública
// ==========================================
export const VaultService = {
  /**
   * Retorna todos os itens decriptografados em memória RAM.
   * A chave mestra DEVE estar carregada via SessionService.
   */
  async getAll(): Promise<(VaultItem & { _plaintextPassword: string })[]> {
    const vault = await loadStoredVault();
    const results = await Promise.all(vault.items.map(decryptItem));
    return results as any;
  },

  /**
   * Cria uma nova credencial e a persiste criptografada.
   */
  async create(params: {
    title: string;
    username: string;
    password: string;
    url: string;
    notes?: string;
  }): Promise<string> {
    const key = SessionService.getMasterKey();
    const vault = await loadStoredVault();
    const id = generateId();

    const encryptedUsername = await encryptData(params.username, key);
    const encryptedPassword = await encryptData(params.password, key);
    const encryptedNotes = params.notes
      ? await encryptData(params.notes, key)
      : undefined;

    const newItem: StoredVaultItem = {
      id,
      title: params.title,
      encryptedUsername,
      encryptedPassword,
      url: params.url,
      encryptedNotes,
      updatedAt: new Date().toISOString(),
      history: [],
    };

    vault.items.unshift(newItem);
    await saveStoredVault(vault);
    const email = SessionService.getActiveUserEmail() || '';
    await StorageService.addAuditLog(email, 'CREDENTIAL_CREATED', `Credencial "${params.title}" criada.`);

    return id;
  },

  /**
   * Atualiza uma credencial existente, preservando o histórico das últimas 5 versões.
   */
  async update(
    id: string,
    params: {
      title?: string;
      username?: string;
      password?: string;
      url?: string;
      notes?: string;
    }
  ): Promise<void> {
    const key = SessionService.getMasterKey();
    const vault = await loadStoredVault();
    const idx = vault.items.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Credencial não encontrada no cofre.');

    const current = vault.items[idx];

    // Salva versão anterior no histórico (máx. 5)
    const historyEntry: StoredHistoryItem = {
      id: generateId(),
      encryptedUsername: current.encryptedUsername,
      encryptedPassword: current.encryptedPassword,
      updatedAt: current.updatedAt,
    };
    const updatedHistory = [historyEntry, ...current.history].slice(0, 5);

    // Encripta campos novos (se fornecidos)
    const encryptedUsername = params.username
      ? await encryptData(params.username, key)
      : current.encryptedUsername;
    const encryptedPassword = params.password
      ? await encryptData(params.password, key)
      : current.encryptedPassword;
    const encryptedNotes = params.notes
      ? await encryptData(params.notes, key)
      : current.encryptedNotes;

    vault.items[idx] = {
      ...current,
      title: params.title ?? current.title,
      url: params.url ?? current.url,
      encryptedUsername,
      encryptedPassword,
      encryptedNotes,
      updatedAt: new Date().toISOString(),
      history: updatedHistory,
    };

    await saveStoredVault(vault);
    const email = SessionService.getActiveUserEmail() || '';
    await StorageService.addAuditLog(email, 'CREDENTIAL_UPDATED', `Credencial "${vault.items[idx].title}" atualizada.`);
  },

  /**
   * Remove uma credencial permanentemente do cofre.
   */
  async remove(id: string): Promise<void> {
    const vault = await loadStoredVault();
    const item = vault.items.find((i) => i.id === id);
    const title = item?.title ?? id;
    vault.items = vault.items.filter((i) => i.id !== id);
    await saveStoredVault(vault);
    const email = SessionService.getActiveUserEmail() || '';
    await StorageService.addAuditLog(email, 'CREDENTIAL_DELETED', `Credencial "${title}" removida.`);
  },

  /**
   * Retorna a senha em texto claro de um item específico.
   * Exige que a chave mestra esteja na RAM (acesso protegido).
   */
  async revealPassword(id: string): Promise<string> {
    const key = SessionService.getMasterKey();
    const vault = await loadStoredVault();
    const item = vault.items.find((i) => i.id === id);
    if (!item) throw new Error('Credencial não encontrada.');
    const email = SessionService.getActiveUserEmail() || '';
    await StorageService.addAuditLog(email, 'PASSWORD_COPIED', `Senha de "${item.title}" revelada/copiada.`);
    return decryptData(item.encryptedPassword, key);
  },

  /**
   * Decriptografa a senha de uma entrada do histórico.
   */
  async revealHistoryPassword(itemId: string, historyId: string): Promise<string> {
    const key = SessionService.getMasterKey();
    const vault = await loadStoredVault();
    const item = vault.items.find((i) => i.id === itemId);
    if (!item) throw new Error('Credencial não encontrada.');
    const hist = item.history.find((h) => h.id === historyId);
    if (!hist) throw new Error('Entrada de histórico não encontrada.');
    return decryptData(hist.encryptedPassword, key);
  },

  /**
   * Exporta o vault como JSON criptografado (apenas ciphertext) para backup.
   * NUNCA contém dados em texto claro.
   */
  async exportEncryptedBlob(): Promise<string> {
    const email = SessionService.getActiveUserEmail() || '';
    const raw = await StorageService.getEncryptedVault(email);
    const profile = await StorageService.getUserProfile(email);
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      salt: profile?.salt,
      iterations: 100000,
      algorithm: 'AES-256-GCM / PBKDF2-SHA256',
      vault: raw ? JSON.parse(raw) : { items: [] },
    };
    await StorageService.addAuditLog(email, 'BACKUP_EXPORTED', 'Backup criptografado exportado com sucesso.');
    return JSON.stringify(exportData, null, 2);
  },

  /**
   * Importa um backup criptografado em formato JSON.
   * Decifra o backup usando a senha mestra fornecida (que pode ser igual ou diferente da atual)
   * e o salt contido no backup, e em seguida re-encripta tudo com a chave mestra atual na RAM.
   */
  async importEncryptedBlob(
    backupJson: string,
    passwordUsed: string,
    merge: boolean = true
  ): Promise<{ success: boolean; importedCount: number }> {
    try {
      const parsed = JSON.parse(backupJson);
      if (!parsed.version || !parsed.salt || !parsed.vault) {
        throw new Error('Formato de backup inválido.');
      }

      // 1. Deriva a chave temporária do backup usando a senha fornecida e o salt do backup
      const tempKey = await deriveKey(passwordUsed, parsed.salt);

      // 2. Tenta descriptografar todos os itens do backup usando essa chave temporária
      const backupItems: StoredVaultItem[] = parsed.vault.items || [];
      const decryptedItems = [];

      for (const item of backupItems) {
        const username = await decryptData(item.encryptedUsername, tempKey);
        const password = await decryptData(item.encryptedPassword, tempKey);
        const notes = item.encryptedNotes
          ? await decryptData(item.encryptedNotes, tempKey)
          : undefined;

        const decryptedHistory = [];
        if (item.history) {
          for (const h of item.history) {
            const hUsername = await decryptData(h.encryptedUsername, tempKey);
            const hPassword = await decryptData(h.encryptedPassword, tempKey);
            decryptedHistory.push({
              username: hUsername,
              password: hPassword,
              updatedAt: h.updatedAt,
            });
          }
        }

        decryptedItems.push({
          id: item.id,
          title: item.title,
          url: item.url,
          username,
          password,
          notes,
          updatedAt: item.updatedAt,
          history: decryptedHistory,
        });
      }

      // 3. Re-encripta tudo com a chave mestra ativa do usuário atual na RAM
      const currentKey = SessionService.getMasterKey();
      const newlyEncryptedItems: StoredVaultItem[] = [];

      for (const item of decryptedItems) {
        const encryptedUsername = await encryptData(item.username, currentKey);
        const encryptedPassword = await encryptData(item.password, currentKey);
        const encryptedNotes = item.notes
          ? await encryptData(item.notes, currentKey)
          : undefined;

        const newlyEncryptedHistory: StoredHistoryItem[] = [];
        for (const h of item.history) {
          const hEncUsername = await encryptData(h.username, currentKey);
          const hEncPassword = await encryptData(h.password, currentKey);
          newlyEncryptedHistory.push({
            id: generateId(),
            encryptedUsername: hEncUsername,
            encryptedPassword: hEncPassword,
            updatedAt: h.updatedAt,
          });
        }

        newlyEncryptedItems.push({
          id: item.id,
          title: item.title,
          url: item.url,
          encryptedUsername,
          encryptedPassword,
          encryptedNotes,
          updatedAt: item.updatedAt,
          history: newlyEncryptedHistory,
        });
      }

      // 4. Salva no Storage
      const currentStoredVault = await loadStoredVault();
      let finalItems: StoredVaultItem[] = [];

      if (merge) {
        // Mescla sem duplicar IDs
        const currentMap = new Map<string, StoredVaultItem>();
        currentStoredVault.items.forEach((item) => currentMap.set(item.id, item));
        newlyEncryptedItems.forEach((item) => currentMap.set(item.id, item));
        finalItems = Array.from(currentMap.values());
      } else {
        // Substituição completa
        finalItems = newlyEncryptedItems;
      }

      await saveStoredVault({ items: finalItems });
      const email = SessionService.getActiveUserEmail() || '';
      await StorageService.addAuditLog(email, 'BACKUP_EXPORTED', `Backup importado com sucesso (${newlyEncryptedItems.length} credenciais).`);

      return { success: true, importedCount: newlyEncryptedItems.length };
    } catch (e: any) {
      console.error('[VaultService] Erro ao importar backup:', e);
      throw new Error(e.message || 'Falha ao descriptografar ou processar o backup. Verifique a senha mestra digitada.');
    }
  },

  /**
   * Análise de saúde das senhas (Módulo 4 preview).
   * Roda localmente em RAM sem persistir dados decriptografados.
   */
  async analyzePasswordHealth(): Promise<{
    total: number;
    weak: number;
    reused: number;
    strongCount: number;
  }> {
    const items = await this.getAll();
    const passwords = items.map((i) => (i as any)._plaintextPassword as string);
    const seen = new Map<string, number>();

    passwords.forEach((p) => seen.set(p, (seen.get(p) ?? 0) + 1));

    const weak = passwords.filter((p) => p.length < 12 || !/[A-Z]/.test(p) || !/[0-9]/.test(p) || !/[!@#$%^&*]/.test(p)).length;
    const reused = [...seen.values()].filter((count) => count > 1).reduce((acc, count) => acc + count, 0);

    return {
      total: passwords.length,
      weak,
      reused,
      strongCount: passwords.length - weak,
    };
  },
};
