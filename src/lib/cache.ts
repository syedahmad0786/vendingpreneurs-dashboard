/**
 * Simple in-memory cache with configurable TTL (Time To Live).
 * Used to cache Airtable responses and computed dashboard stats.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

class MemoryCache {
  private store: Map<string, CacheEntry<unknown>> = new Map();

  /**
   * Get a cached value by key.
   * Returns undefined if the key does not exist or has expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in cache with optional TTL override.
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Time to live in milliseconds (default: 5 minutes)
   */
  set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidate (remove) a specific key from the cache.
   */
  invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Check if a key exists and has not expired.
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get the number of entries currently in the cache (including expired).
   * Call prune() first for an accurate count of live entries.
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Remove all expired entries from the cache.
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

// Singleton instance shared across the application
export const cache = new MemoryCache();
export { DEFAULT_TTL_MS };
export type { CacheEntry };
