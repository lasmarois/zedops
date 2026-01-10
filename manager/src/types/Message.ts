/**
 * NATS-Inspired Message Protocol
 *
 * Subject-based routing system for agent-manager communication.
 * Supports request/reply pattern and pub/sub fanout.
 */

/**
 * Message structure for NATS-inspired protocol
 */
export interface Message {
  /** Subject for routing (e.g., "agent.register", "server.start") */
  subject: string;

  /** Reply inbox for request/reply pattern (optional) */
  reply?: string;

  /** Message payload (JSON-serializable) */
  data: any;

  /** Unix timestamp in milliseconds (optional) */
  timestamp?: number;
}

/**
 * Message validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate message structure
 */
export function validateMessage(obj: any): ValidationResult {
  // Check if object exists
  if (!obj || typeof obj !== 'object') {
    return { valid: false, error: 'Message must be an object' };
  }

  // Check required field: subject
  if (!obj.subject || typeof obj.subject !== 'string') {
    return { valid: false, error: 'Message must have a "subject" string field' };
  }

  // Validate subject format (alphanumeric + dots)
  const subjectRegex = /^[a-z0-9._-]+$/i;
  if (!subjectRegex.test(obj.subject)) {
    return { valid: false, error: 'Subject must contain only alphanumeric characters, dots, underscores, and hyphens' };
  }

  // Validate reply field if present
  if (obj.reply !== undefined && typeof obj.reply !== 'string') {
    return { valid: false, error: 'Reply field must be a string if present' };
  }

  // Validate timestamp if present
  if (obj.timestamp !== undefined && typeof obj.timestamp !== 'number') {
    return { valid: false, error: 'Timestamp field must be a number if present' };
  }

  return { valid: true };
}

/**
 * Create a message with timestamp
 */
export function createMessage(subject: string, data: any, reply?: string): Message {
  const message: Message = {
    subject,
    data,
    timestamp: Date.now(),
  };

  if (reply) {
    message.reply = reply;
  }

  return message;
}

/**
 * Generate a unique inbox subject for request/reply pattern
 * Format: inbox.<random-uuid>
 */
export function generateInbox(): string {
  return `inbox.${crypto.randomUUID()}`;
}

/**
 * Check if subject is an inbox reply
 */
export function isInboxSubject(subject: string): boolean {
  return subject.startsWith('inbox.');
}

/**
 * Parse raw message data into Message object
 */
export function parseMessage(data: string | any): Message {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }
  return data;
}
