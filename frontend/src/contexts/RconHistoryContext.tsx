/**
 * RCON History Context
 * Shares RCON command history between RCON Terminal and Preview components
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface RconHistoryEntry {
  timestamp: number;
  command: string;
  response: string;
}

interface RconHistoryContextType {
  history: RconHistoryEntry[];
  addEntry: (command: string, response: string) => void;
  clearHistory: () => void;
}

const RconHistoryContext = createContext<RconHistoryContextType | undefined>(undefined);

export function useRconHistory() {
  const context = useContext(RconHistoryContext);
  if (!context) {
    throw new Error('useRconHistory must be used within RconHistoryProvider');
  }
  return context;
}

interface RconHistoryProviderProps {
  children: ReactNode;
  serverId: string;
}

export function RconHistoryProvider({ children, serverId }: RconHistoryProviderProps) {
  const storageKey = `rcon-history-${serverId}`;

  // Initialize from sessionStorage
  const [history, setHistory] = useState<RconHistoryEntry[]>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist to sessionStorage on change
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(history));
  }, [history, storageKey]);

  const addEntry = (command: string, response: string) => {
    const entry: RconHistoryEntry = {
      timestamp: Date.now(),
      command,
      response,
    };

    // Keep last 10 entries
    setHistory(prev => [...prev, entry].slice(-10));
  };

  const clearHistory = () => {
    setHistory([]);
    sessionStorage.removeItem(storageKey);
  };

  return (
    <RconHistoryContext.Provider value={{ history, addEntry, clearHistory }}>
      {children}
    </RconHistoryContext.Provider>
  );
}
