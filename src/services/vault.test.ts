import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VaultService } from './vault';
import { SessionService } from './session';
import { StorageService } from './storage';
import { deriveKey } from '../crypto/webcrypto';

// Mocks do Firebase para os testes rodarem offline
let mockStore: Record<string, any> = {};

vi.mock('./firebase', () => {
  return {
    auth: {
      currentUser: { uid: 'mock-uid-123' }
    },
    db: {}
  };
});

vi.mock('firebase/auth', () => {
  return {
    signInWithEmailAndPassword: async () => ({ user: { uid: 'mock-uid-123' } }),
    createUserWithEmailAndPassword: async () => ({ user: { uid: 'mock-uid-123' } }),
    signOut: async () => {}
  };
});

vi.mock('firebase/firestore', () => {
  return {
    doc: (db: any, col: string, id: string) => `${col}/${id}`,
    getDoc: async (docRef: string) => ({
      exists: () => !!mockStore[docRef],
      data: () => mockStore[docRef]
    }),
    setDoc: async (docRef: string, data: any) => {
      mockStore[docRef] = data;
    },
    updateDoc: async (docRef: string, data: any) => {
      mockStore[docRef] = { ...mockStore[docRef], ...data };
    }
  };
});

// Mock do Preferences do Capacitor (StorageService depende dele)
vi.mock('@capacitor/preferences', () => {
  let store: Record<string, string> = {};
  return {
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store[key] || null }),
      set: async ({ key, value }: { key: string; value: string }) => {
        store[key] = value;
      },
      remove: async ({ key }: { key: string }) => {
        delete store[key];
      },
      clear: async () => {
        store = {};
      },
    },
  };
});

describe('VaultService Criptográfico - Suíte de Testes (Zero-Knowledge)', () => {
  const masterPassword = 'MasterPassword@987654321';
  let masterKey: CryptoKey;

  beforeEach(async () => {
    // Limpa estado anterior do banco simulado
    mockStore = {};
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.clear();
    SessionService.clearSession();

    // Inicializa perfil do usuário para o teste
    await SessionService.registerUser('testuser@tcc.com', masterPassword);
    masterKey = SessionService.getMasterKey();
  });

  it('deve armazenar credenciais criptografadas de forma que o plaintext nunca toque o disco', async () => {
    const id = await VaultService.create({
      title: 'Minha Conta de Teste',
      username: 'usuario_teste',
      password: 'SenhaUltraSecreta@2026',
      url: 'https://exemplo-seguro.com',
      notes: 'Nota secreta do cofre',
    });

    expect(id).toBeDefined();

    // Busca o dado bruto no banco (StorageService)
    const rawVault = await StorageService.getEncryptedVault('testuser@tcc.com');
    expect(rawVault).toBeDefined();
    expect(rawVault).not.toContain('usuario_teste');
    expect(rawVault).not.toContain('SenhaUltraSecreta@2026');
    expect(rawVault).not.toContain('Nota secreta do cofre');

    // Descriptografa em RAM via VaultService
    const all = await VaultService.getAll();
    expect(all.length).toBe(1);
    expect(all[0].title).toBe('Minha Conta de Teste');
    expect(all[0].username).toBe('usuario_teste');
    expect(all[0]._plaintextPassword).toBe('SenhaUltraSecreta@2026');
  });

  it('deve manter histórico de até 5 versões criptografadas de senhas antigas', async () => {
    const id = await VaultService.create({
      title: 'Banco Cripto',
      username: 'client_crypto',
      password: 'senha_original_123',
      url: 'https://banco.com',
    });

    // Atualiza a senha 3 vezes
    await VaultService.update(id, { password: 'senha_segunda_456' });
    await VaultService.update(id, { password: 'senha_terceira_789' });
    await VaultService.update(id, { password: 'senha_quarta_abc' });

    const all = await VaultService.getAll();
    const item = all[0];

    expect(item._plaintextPassword).toBe('senha_quarta_abc');
    expect(item.history).toBeDefined();
    expect(item.history!.length).toBe(3);

    // Revela a senha original de uma entrada do histórico
    const firstHist = item.history![2]; // A mais antiga é a última do array
    const originalPass = await VaultService.revealHistoryPassword(id, firstHist.id);
    expect(originalPass).toBe('senha_original_123');

    // Revela a segunda senha
    const secondHist = item.history![1];
    const secondPass = await VaultService.revealHistoryPassword(id, secondHist.id);
    expect(secondPass).toBe('senha_segunda_456');
  });

  it('deve realizar análise matemática local de saúde das senhas sem enviar dados à rede', async () => {
    // Cadastra uma senha fraca
    await VaultService.create({
      title: 'Fraca',
      username: 'user1',
      password: '123',
      url: 'https://site1.com',
    });

    // Cadastra uma senha forte, mas reutilizada
    await VaultService.create({
      title: 'Forte Reutilizada 1',
      username: 'user2',
      password: 'SenhaSuperForte@2026!',
      url: 'https://site2.com',
    });

    await VaultService.create({
      title: 'Forte Reutilizada 2',
      username: 'user3',
      password: 'SenhaSuperForte@2026!',
      url: 'https://site3.com',
    });

    const analysis = await VaultService.analyzePasswordHealth();
    expect(analysis.total).toBe(3);
    expect(analysis.weak).toBe(1); // '123' é fraca
    expect(analysis.reused).toBe(2); // 'SenhaSuperForte@2026!' é duplicada
  });

  it('deve exportar backup contendo apenas ciphertext (Zero-Knowledge)', async () => {
    await VaultService.create({
      title: 'Backup Test',
      username: 'backup_user',
      password: 'PasswordBackup123!',
      url: 'https://backup.com',
    });

    const backupBlob = await VaultService.exportEncryptedBlob();
    expect(backupBlob).toBeDefined();
    
    // O backup é uma string JSON
    const parsed = JSON.parse(backupBlob);
    expect(parsed.version).toBe('1.0');
    expect(parsed.salt).toBeDefined();
    expect(parsed.vault).toBeDefined();

    // Garante que o backup não tem texto claro exposto
    const rawString = JSON.stringify(parsed.vault);
    expect(rawString).not.toContain('backup_user');
    expect(rawString).not.toContain('PasswordBackup123!');
  });

  it('deve importar backup criptografado decifrando-o com a senha correta e re-encriptando-o com a chave do usuário ativo', async () => {
    // 1. Cadastra credencial
    await VaultService.create({
      title: 'Site de Compra',
      username: 'comprador1',
      password: 'SenhaSecretaCompras@99',
      url: 'https://loja.com',
    });

    // 2. Exporta o backup
    const backupJson = await VaultService.exportEncryptedBlob();

    // 3. Simula reset do app (limpa tudo) e cria um novo perfil de usuário com senha diferente
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.clear();
    SessionService.clearSession();

    const novaSenhaMestra = 'NovaSenhaMestraSuperForte@2026';
    await SessionService.registerUser('newuser@tcc.com', novaSenhaMestra);

    // 4. Tenta importar com senha errada (deve falhar)
    await expect(
      VaultService.importEncryptedBlob(backupJson, 'SenhaMestraIncorreta@123', true)
    ).rejects.toThrow();

    // 5. Importa com a senha correta (a que foi usada no backup anterior)
    const res = await VaultService.importEncryptedBlob(backupJson, masterPassword, true);
    expect(res.success).toBe(true);
    expect(res.importedCount).toBe(1);

    // 6. Verifica se o item importado foi re-criptografado e pode ser lido com a NOVA senha mestra ativa
    const all = await VaultService.getAll();
    expect(all.length).toBe(1);
    expect(all[0].title).toBe('Site de Compra');
    expect(all[0].username).toBe('comprador1');
    expect(all[0]._plaintextPassword).toBe('SenhaSecretaCompras@99');
  });
});
