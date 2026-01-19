/**
 * Token generation and validation using Jose (JWT library for Workers)
 *
 * Two types of tokens:
 * 1. Ephemeral tokens: Short-lived (1 hour), for initial registration
 * 2. Permanent tokens: No expiry, for ongoing agent authentication
 */

import * as jose from 'jose';

/**
 * Generate ephemeral token for agent registration
 * Valid for 1 hour
 * Includes agentId for pre-registered pending agents
 */
export async function generateEphemeralToken(
  agentId: string,
  agentName: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  const jwt = await new jose.SignJWT({
    type: 'ephemeral',
    agentId,
    agentName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretKey);

  return jwt;
}

/**
 * Generate permanent token for agent
 * No expiration - valid until revoked
 */
export async function generatePermanentToken(
  agentId: string,
  agentName: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  const jwt = await new jose.SignJWT({
    type: 'permanent',
    agentId,
    agentName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secretKey);

  return jwt;
}

/**
 * Verify and decode token
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<jose.JWTPayload> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  const { payload } = await jose.jwtVerify(token, secretKey);
  return payload;
}

/**
 * Hash token for storage (SHA-256)
 * We store hashes, not raw tokens
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
