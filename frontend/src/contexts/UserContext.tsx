/**
 * User Context
 *
 * Provides global user state and authentication functions.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import * as authLib from '../lib/auth';
import type { User } from '../lib/auth';

interface UserContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = authLib.getUser();
    if (storedUser && authLib.hasToken()) {
      setUser(storedUser);
    }
  }, []);

  const login = (token: string, userData: User) => {
    authLib.login(token, userData);
    setUser(userData);
  };

  const logout = () => {
    authLib.logout();
    setUser(null);
  };

  const updateUser = (userData: User) => {
    authLib.setUser(userData);
    setUser(userData);
  };

  const value: UserContextType = {
    user,
    isAuthenticated: !!user && authLib.hasToken(),
    login,
    logout,
    updateUser,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
