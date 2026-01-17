/**
 * ServerCardLayoutContext - Provides layout preference for server cards
 *
 * Persists user preference in localStorage.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ServerCardLayout } from '@/components/ServerCard';

const STORAGE_KEY = 'zedops-server-card-layout';

interface ServerCardLayoutContextValue {
  layout: ServerCardLayout;
  setLayout: (layout: ServerCardLayout) => void;
  toggleLayout: () => void;
}

const ServerCardLayoutContext = createContext<ServerCardLayoutContextValue | null>(null);

export function ServerCardLayoutProvider({ children }: { children: ReactNode }) {
  // Load from localStorage or default to compact
  const [layout, setLayoutState] = useState<ServerCardLayout>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'expandable' || saved === 'compact') {
        return saved;
      }
    }
    return 'compact';
  });

  // Persist to localStorage when layout changes
  const setLayout = (newLayout: ServerCardLayout) => {
    setLayoutState(newLayout);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLayout);
    }
  };

  const toggleLayout = () => {
    setLayout(layout === 'expandable' ? 'compact' : 'expandable');
  };

  return (
    <ServerCardLayoutContext.Provider value={{ layout, setLayout, toggleLayout }}>
      {children}
    </ServerCardLayoutContext.Provider>
  );
}

export function useServerCardLayout() {
  const context = useContext(ServerCardLayoutContext);
  if (!context) {
    throw new Error('useServerCardLayout must be used within ServerCardLayoutProvider');
  }
  return context;
}
