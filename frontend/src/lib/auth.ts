/**
 * Client-side Authentication Helpers
 *
 * Manages JWT token storage and user session state in the browser.
 */

const TOKEN_KEY = 'zedops_token';
const USER_KEY = 'zedops_user';

export interface User {
  id: string;
  email: string;
  role: string;
}

// ============================================================================
// Token Storage
// ============================================================================

/**
 * Store JWT token in localStorage
 */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Get JWT token from localStorage
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Remove JWT token from localStorage
 */
export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Check if user has a token (is potentially authenticated)
 */
export function hasToken(): boolean {
  return !!getToken();
}

// ============================================================================
// User Storage
// ============================================================================

/**
 * Store user info in localStorage
 */
export function setUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Get user info from localStorage
 */
export function getUser(): User | null {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;

  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

/**
 * Remove user info from localStorage
 */
export function removeUser(): void {
  localStorage.removeItem(USER_KEY);
}

// ============================================================================
// Combined Operations
// ============================================================================

/**
 * Log in user - store token and user info
 */
export function login(token: string, user: User): void {
  setToken(token);
  setUser(user);
}

/**
 * Log out user - clear token and user info
 */
export function logout(): void {
  removeToken();
  removeUser();
}

/**
 * Check if user is authenticated (has token and user info)
 */
export function isAuthenticated(): boolean {
  return hasToken() && !!getUser();
}
