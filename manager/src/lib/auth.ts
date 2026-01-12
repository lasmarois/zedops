/**
 * Authentication Library
 *
 * Provides password hashing, validation, and JWT session token management
 * for user authentication in ZedOps.
 *
 * Uses bcryptjs for password hashing (10 rounds) and Jose for JWT tokens.
 */

import bcrypt from 'bcryptjs';
import * as jose from 'jose';

// ============================================================================
// Password Hashing
// ============================================================================

/**
 * Hash a plain-text password using bcrypt (10 rounds)
 *
 * @param password - Plain-text password
 * @returns Promise<string> - Bcrypt hash
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

/**
 * Verify a plain-text password against a bcrypt hash
 *
 * @param password - Plain-text password
 * @param hash - Bcrypt hash
 * @returns Promise<boolean> - True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// ============================================================================
// Password Validation
// ============================================================================

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate password strength requirements
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 *
 * @param password - Password to validate
 * @returns PasswordValidationResult - Validation result with errors
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least 1 uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least 1 lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least 1 number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// JWT Session Tokens
// ============================================================================

export interface UserSessionPayload {
  type: 'user_session';
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Generate a JWT session token for a user (7-day expiry)
 *
 * @param userId - User ID
 * @param email - User email
 * @param role - User role (admin, operator, viewer)
 * @param secret - JWT signing secret
 * @returns Promise<string> - JWT token
 */
export async function generateSessionToken(
  userId: string,
  email: string,
  role: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  const jwt = await new jose.SignJWT({
    type: 'user_session',
    userId,
    email,
    role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);

  return jwt;
}

/**
 * Verify and decode a user session JWT token
 *
 * @param token - JWT token
 * @param secret - JWT signing secret
 * @returns Promise<UserSessionPayload> - Decoded token payload
 * @throws Error if token is invalid or expired
 */
export async function verifySessionToken(
  token: string,
  secret: string
): Promise<UserSessionPayload> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  const { payload } = await jose.jwtVerify(token, secretKey);

  // Validate token type
  if (payload.type !== 'user_session') {
    throw new Error('Invalid token type');
  }

  return payload as UserSessionPayload;
}

// ============================================================================
// Token Hashing (for storing in database)
// ============================================================================

/**
 * Hash a token using SHA-256 for storage in database
 *
 * @param token - JWT token
 * @returns Promise<string> - SHA-256 hash (hex)
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
