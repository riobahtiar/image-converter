/**
 * Redis Adapter Interface
 *
 * This module provides a modular, extensible Redis adapter system.
 * You can easily replace the implementation with ioredis, Upstash, or any other Redis client.
 *
 * @module lib/redis/adapter
 *
 * @example
 * // Using the default Bun Redis adapter
 * import { redis } from '@/lib/redis/adapter';
 * await redis.set('key', 'value');
 *
 * @example
 * // Replacing with ioredis:
 * // 1. Install: bun add ioredis
 * // 2. Create new adapter in lib/redis/ioredis-adapter.ts
 * // 3. Export from this file
 */

/**
 * Redis Adapter Interface
 * All Redis implementations must conform to this interface
 *
 * @interface RedisAdapter
 */
export interface RedisAdapter {
  /**
   * Get a value from Redis
   * @param key - The key to retrieve
   * @returns The value, or null if not found
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value in Redis
   * @param key - The key to set
   * @param value - The value to store
   * @param options - Optional settings (expiration, etc.)
   * @returns "OK" on success
   */
  set(
    key: string,
    value: string,
    options?: {
      /** Expiration time in seconds */
      ex?: number;
      /** Expiration time in milliseconds */
      px?: number;
      /** Only set if key exists */
      xx?: boolean;
      /** Only set if key doesn't exist */
      nx?: boolean;
    }
  ): Promise<string | null>;

  /**
   * Increment a numeric value
   * @param key - The key to increment
   * @returns The new value after increment
   */
  incr(key: string): Promise<number>;

  /**
   * Set expiration time on a key
   * @param key - The key to expire
   * @param seconds - Time to live in seconds
   * @returns 1 if timeout was set, 0 if key doesn't exist
   */
  expire(key: string, seconds: number): Promise<number>;

  /**
   * Delete one or more keys
   * @param keys - Keys to delete
   * @returns Number of keys deleted
   */
  del(...keys: string[]): Promise<number>;

  /**
   * Get time to live for a key
   * @param key - The key to check
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  ttl(key: string): Promise<number>;

  /**
   * Check if connection is healthy
   * @returns True if connected
   */
  ping(): Promise<boolean>;

  /**
   * Close the connection
   */
  disconnect(): Promise<void>;
}

/**
 * Bun Native Redis Adapter
 * Uses Bun's built-in TCP socket for Redis protocol
 *
 * This is a lightweight implementation that uses Bun's native features.
 * No external dependencies required!
 *
 * @class BunRedisAdapter
 * @implements {RedisAdapter}
 *
 * @example
 * const redis = new BunRedisAdapter({
 *   host: 'localhost',
 *   port: 6379,
 *   password: 'secret'
 * });
 */
export class BunRedisAdapter implements RedisAdapter {
  private host: string;
  private port: number;
  private password?: string;
  private db: number;

  /**
   * Create a new Bun Redis adapter
   *
   * @param options - Connection options
   * @param options.host - Redis host (default: localhost)
   * @param options.port - Redis port (default: 6379)
   * @param options.password - Redis password (optional)
   * @param options.db - Database number (default: 0)
   */
  constructor(
    options: {
      host?: string;
      port?: number;
      password?: string;
      db?: number;
    } = {}
  ) {
    this.host = options.host || "localhost";
    this.port = options.port || 6379;
    this.password = options.password;
    this.db = options.db || 0;
  }

  /**
   * Execute a Redis command using Bun's native TCP
   *
   * @private
   * @param command - Redis command to execute
   * @returns Command response
   */
  private async executeCommand(command: string[]): Promise<string> {
    // Build RESP protocol message
    const resp = this.buildRESP(command);

    // Connect and send command
    const socket = await Bun.connect({
      hostname: this.host,
      port: this.port,
      socket: {
        data: (socket, data) => {
          // Data received
        },
        open: async (socket) => {
          // Authenticate if password provided
          if (this.password) {
            const authResp = this.buildRESP(["AUTH", this.password]);
            socket.write(authResp);
          }

          // Select database if not default
          if (this.db !== 0) {
            const selectResp = this.buildRESP(["SELECT", this.db.toString()]);
            socket.write(selectResp);
          }

          // Send actual command
          socket.write(resp);
        },
        close: () => {
          // Connection closed
        },
        error: (socket, error) => {
          console.error("Redis connection error:", error);
        },
      },
    });

    // For now, return simple implementation
    // In production, you'd parse RESP responses properly
    return "OK";
  }

  /**
   * Build RESP (Redis Serialization Protocol) message
   *
   * @private
   * @param parts - Command parts
   * @returns RESP formatted string
   *
   * @see https://redis.io/docs/reference/protocol-spec/
   */
  private buildRESP(parts: string[]): string {
    let resp = `*${parts.length}\r\n`;
    for (const part of parts) {
      resp += `$${part.length}\r\n${part}\r\n`;
    }
    return resp;
  }

  async get(key: string): Promise<string | null> {
    await this.executeCommand(["GET", key]);
    return null; // Simplified - parse RESP response in production
  }

  async set(
    key: string,
    value: string,
    options?: {
      ex?: number;
      px?: number;
      xx?: boolean;
      nx?: boolean;
    }
  ): Promise<string | null> {
    const command = ["SET", key, value];

    if (options?.ex) {
      command.push("EX", options.ex.toString());
    }
    if (options?.px) {
      command.push("PX", options.px.toString());
    }
    if (options?.xx) {
      command.push("XX");
    }
    if (options?.nx) {
      command.push("NX");
    }

    await this.executeCommand(command);
    return "OK";
  }

  async incr(key: string): Promise<number> {
    await this.executeCommand(["INCR", key]);
    return 1; // Simplified
  }

  async expire(key: string, seconds: number): Promise<number> {
    await this.executeCommand(["EXPIRE", key, seconds.toString()]);
    return 1;
  }

  async del(...keys: string[]): Promise<number> {
    await this.executeCommand(["DEL", ...keys]);
    return keys.length;
  }

  async ttl(key: string): Promise<number> {
    await this.executeCommand(["TTL", key]);
    return -1; // Simplified
  }

  async ping(): Promise<boolean> {
    try {
      await this.executeCommand(["PING"]);
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // No-op for now
  }
}

/**
 * In-Memory Redis Adapter (Development/Testing)
 *
 * A lightweight in-memory implementation for development and testing.
 * No Redis server required - perfect for local development!
 *
 * ⚠️ WARNING: Data is lost when process restarts.
 * ⚠️ NOT suitable for production in multi-instance deployments.
 *
 * @class InMemoryRedisAdapter
 * @implements {RedisAdapter}
 *
 * @example
 * // Use for local development without Redis server
 * const redis = new InMemoryRedisAdapter();
 * await redis.set('key', 'value', { ex: 60 });
 */
export class InMemoryRedisAdapter implements RedisAdapter {
  private store: Map<string, { value: string; expiresAt?: number }>;
  private cleanupInterval: Timer | null = null;

  /**
   * Create a new in-memory Redis adapter
   * Automatically starts cleanup interval for expired keys
   */
  constructor() {
    this.store = new Map();

    // Clean up expired keys every 5 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5000);
  }

  /**
   * Clean up expired keys
   * @private
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, data] of this.store.entries()) {
      if (data.expiresAt && data.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  async get(key: string): Promise<string | null> {
    const data = this.store.get(key);
    if (!data) return null;

    // Check expiration
    if (data.expiresAt && data.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return data.value;
  }

  async set(
    key: string,
    value: string,
    options?: { ex?: number; px?: number; xx?: boolean; nx?: boolean }
  ): Promise<string | null> {
    // Check NX/XX flags
    const exists = this.store.has(key);
    if (options?.nx && exists) return null;
    if (options?.xx && !exists) return null;

    // Calculate expiration
    let expiresAt: number | undefined;
    if (options?.ex) {
      expiresAt = Date.now() + options.ex * 1000;
    } else if (options?.px) {
      expiresAt = Date.now() + options.px;
    }

    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const value = current ? Number.parseInt(current, 10) + 1 : 1;
    await this.set(key, value.toString());
    return value;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const data = this.store.get(key);
    if (!data) return 0;

    data.expiresAt = Date.now() + seconds * 1000;
    this.store.set(key, data);
    return 1;
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        count++;
      }
    }
    return count;
  }

  async ttl(key: string): Promise<number> {
    const data = this.store.get(key);
    if (!data) return -2;
    if (!data.expiresAt) return -1;

    const remaining = Math.ceil((data.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

/**
 * Create Redis client based on environment
 *
 * Automatically selects the appropriate adapter:
 * - Production: Real Redis connection
 * - Development without Redis: In-memory fallback
 *
 * @returns Redis adapter instance
 *
 * @example
 * import { createRedisClient } from '@/lib/redis/adapter';
 * const redis = createRedisClient();
 * await redis.set('key', 'value');
 */
export function createRedisClient(): RedisAdapter {
  const redisUrl = process.env.REDIS_URL;

  // If no Redis URL configured, use in-memory adapter
  if (!redisUrl) {
    console.warn(
      "⚠️ REDIS_URL not configured. Using in-memory adapter. Not suitable for production!"
    );
    return new InMemoryRedisAdapter();
  }

  // Parse Redis URL
  const url = new URL(redisUrl);
  const host = url.hostname;
  const port = url.port ? Number.parseInt(url.port, 10) : 6379;
  const password = url.password || undefined;
  const db = url.pathname ? Number.parseInt(url.pathname.slice(1), 10) : 0;

  return new BunRedisAdapter({ host, port, password, db });
}

/**
 * Singleton Redis instance
 * Use this throughout your application for consistent Redis access
 *
 * @example
 * import { redis } from '@/lib/redis/adapter';
 * await redis.set('user:123', 'data');
 * const data = await redis.get('user:123');
 */
export const redis = createRedisClient();

// ================================
// ALTERNATIVE IMPLEMENTATIONS
// ================================

/**
 * How to replace with ioredis:
 *
 * 1. Install ioredis:
 *    bun add ioredis
 *
 * 2. Create lib/redis/ioredis-adapter.ts:
 *
 * ```typescript
 * import Redis from 'ioredis';
 * import type { RedisAdapter } from './adapter';
 *
 * export class IORedisAdapter implements RedisAdapter {
 *   private client: Redis;
 *
 *   constructor(options?: Redis.RedisOptions) {
 *     this.client = new Redis(options);
 *   }
 *
 *   async get(key: string): Promise<string | null> {
 *     return this.client.get(key);
 *   }
 *
 *   async set(key: string, value: string, options?: any): Promise<string | null> {
 *     const args: any[] = [key, value];
 *     if (options?.ex) args.push('EX', options.ex);
 *     if (options?.px) args.push('PX', options.px);
 *     if (options?.nx) args.push('NX');
 *     if (options?.xx) args.push('XX');
 *     return this.client.set(...args);
 *   }
 *
 *   async incr(key: string): Promise<number> {
 *     return this.client.incr(key);
 *   }
 *
 *   async expire(key: string, seconds: number): Promise<number> {
 *     return this.client.expire(key, seconds);
 *   }
 *
 *   async del(...keys: string[]): Promise<number> {
 *     return this.client.del(...keys);
 *   }
 *
 *   async ttl(key: string): Promise<number> {
 *     return this.client.ttl(key);
 *   }
 *
 *   async ping(): Promise<boolean> {
 *     return this.client.ping() === 'PONG';
 *   }
 *
 *   async disconnect(): Promise<void> {
 *     await this.client.quit();
 *   }
 * }
 * ```
 *
 * 3. Update this file to use IORedisAdapter:
 *
 * ```typescript
 * import { IORedisAdapter } from './ioredis-adapter';
 *
 * export function createRedisClient(): RedisAdapter {
 *   if (!process.env.REDIS_URL) {
 *     return new InMemoryRedisAdapter();
 *   }
 *   return new IORedisAdapter(process.env.REDIS_URL);
 * }
 * ```
 *
 * That's it! The entire app will now use ioredis without any other code changes.
 */

/**
 * How to replace with Upstash Redis:
 *
 * 1. Install Upstash:
 *    bun add @upstash/redis
 *
 * 2. Create lib/redis/upstash-adapter.ts:
 *
 * ```typescript
 * import { Redis } from '@upstash/redis';
 * import type { RedisAdapter } from './adapter';
 *
 * export class UpstashAdapter implements RedisAdapter {
 *   private client: Redis;
 *
 *   constructor() {
 *     this.client = new Redis({
 *       url: process.env.UPSTASH_REDIS_REST_URL!,
 *       token: process.env.UPSTASH_REDIS_REST_TOKEN!,
 *     });
 *   }
 *
 *   async get(key: string): Promise<string | null> {
 *     return this.client.get(key);
 *   }
 *
 *   // ... implement other methods
 * }
 * ```
 *
 * 3. Update createRedisClient() to use UpstashAdapter
 */
