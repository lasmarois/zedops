/**
 * Log Message Types
 *
 * Types for container log streaming and pub/sub.
 */

/**
 * Single log line from a container
 */
export interface LogLine {
  containerId: string;
  timestamp: number;      // Unix timestamp in milliseconds
  stream: 'stdout' | 'stderr' | 'unknown';
  message: string;
}

/**
 * Log subscriber (UI client)
 */
export interface LogSubscriber {
  id: string;            // Unique subscriber ID
  ws: WebSocket;         // WebSocket connection to UI client
  containerId: string;   // Container being watched
}

/**
 * Log stream request from UI
 */
export interface LogSubscribeRequest {
  containerId: string;
}

/**
 * Log stream start request to agent
 */
export interface LogStreamStartRequest {
  containerId: string;
  tail?: number;         // Number of historical lines (default 1000)
  follow?: boolean;      // Follow logs (default true)
  timestamps?: boolean;  // Include timestamps (default true)
}

/**
 * Circular buffer for log caching
 * FIFO buffer with fixed capacity
 */
export class CircularBuffer<T> {
  private buffer: T[];
  private capacity: number;
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Append item to buffer
   * If full, oldest item is dropped
   */
  append(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      // Buffer full, move head forward (drop oldest)
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Get all items in order (oldest to newest)
   */
  getAll(): T[] {
    if (this.size === 0) return [];

    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.capacity;
      result.push(this.buffer[index]);
    }
    return result;
  }

  /**
   * Get number of items in buffer
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
}
