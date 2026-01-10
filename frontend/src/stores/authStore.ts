/**
 * Authentication store using Zustand
 *
 * Stores admin password in memory (not persisted for security).
 * User must re-enter password on page reload.
 */

import { create } from 'zustand';

interface AuthState {
  password: string | null;
  setPassword: (password: string) => void;
  clearPassword: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  password: null,
  setPassword: (password) => set({ password }),
  clearPassword: () => set({ password: null }),
}));
