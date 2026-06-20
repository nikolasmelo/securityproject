import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { VaultService } from '../services/vault';
import { SessionService } from '../services/session';
import { VaultItem } from '../types';

type VaultItemWithPlain = VaultItem & { _plaintextPassword: string };

interface VaultContextType {
  items: VaultItemWithPlain[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredItems: VaultItemWithPlain[];
  refreshVault: () => Promise<void>;
  createItem: (params: {
    title: string;
    username: string;
    password: string;
    url: string;
    notes?: string;
  }) => Promise<string>;
  updateItem: (
    id: string,
    params: {
      title?: string;
      username?: string;
      password?: string;
      url?: string;
      notes?: string;
    }
  ) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  revealPassword: (id: string) => Promise<string>;
  revealHistoryPassword: (itemId: string, historyId: string) => Promise<string>;
  healthStats: {
    total: number;
    weak: number;
    reused: number;
    strongCount: number;
  } | null;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<VaultItemWithPlain[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [healthStats, setHealthStats] = useState<VaultContextType['healthStats']>(null);

  const refreshVault = useCallback(async () => {
    if (!SessionService.isKeyLoaded()) return;
    setLoading(true);
    try {
      const all = await VaultService.getAll();
      setItems(all);
      const health = await VaultService.analyzePasswordHealth();
      setHealthStats(health);
    } catch (e) {
      console.error('Erro ao carregar o cofre:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshVault();
  }, [refreshVault]);

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.username.toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q)
    );
  });

  const createItem = async (params: Parameters<typeof VaultService.create>[0]) => {
    const id = await VaultService.create(params);
    await refreshVault();
    return id;
  };

  const updateItem = async (id: string, params: Parameters<typeof VaultService.update>[1]) => {
    await VaultService.update(id, params);
    await refreshVault();
  };

  const removeItem = async (id: string) => {
    await VaultService.remove(id);
    await refreshVault();
  };

  const revealPassword = (id: string) => VaultService.revealPassword(id);
  const revealHistoryPassword = (itemId: string, historyId: string) =>
    VaultService.revealHistoryPassword(itemId, historyId);

  return (
    <VaultContext.Provider
      value={{
        items,
        loading,
        searchQuery,
        setSearchQuery,
        filteredItems,
        refreshVault,
        createItem,
        updateItem,
        removeItem,
        revealPassword,
        revealHistoryPassword,
        healthStats,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault deve ser usado dentro de VaultProvider');
  return ctx;
};
