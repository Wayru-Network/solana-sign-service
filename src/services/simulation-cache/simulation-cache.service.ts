
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Cache service to store simulation responses and prevent excessive RPC calls
 * Automatically cleans up entries older than the specified TTL
 */
class SimulationCache {
  private static instance: SimulationCache;
  private cache: Map<string, CacheEntry<any>>;
  private readonly ttl: number; // Time to live in milliseconds
  private cleanupInterval: NodeJS.Timeout;

  private constructor() {
    this.cache = new Map();
    this.ttl = 60 * 1000; // 1 minute in milliseconds
    
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.ttl);
  }

  public static getInstance(): SimulationCache {
    if (!SimulationCache.instance) {
      SimulationCache.instance = new SimulationCache();
    }
    return SimulationCache.instance;
  }

  /**
   * Generate a cache key from the simulation parameters
   * @param params Parameters that uniquely identify the simulation
   */
  private generateKey(params: Record<string, any>): string {
    return JSON.stringify(params);
  }

  /**
   * Check if a cache entry is still valid
   * @param entry The cache entry to check
   */
  private isValid(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < this.ttl;
  }

  /**
   * Remove expired entries from the cache
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
        console.log('🧹 Cleaning up rate limiter cache:', key);
      if (now - entry.timestamp >= this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get a cached response or execute and cache the simulation
   * @param params Parameters that uniquely identify the simulation
   * @param simulationFn Function to execute if cache miss
   */
  public async getOrExecute<T>(
    params: Record<string, any>,
    simulationFn: () => Promise<T>
  ): Promise<T> {
    const key = this.generateKey(params);
    const cached = this.cache.get(key);

    if (cached && this.isValid(cached)) {
      console.log('Simulation found in cache:', key);
      return cached.data as T;
    }

    console.log('Simulation not found in cache:', key);
    const result = await simulationFn();
    
    this.cache.set(key, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Clear all entries from the cache
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Clean up resources when shutting down
   */
  public destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

export const simulationCache = SimulationCache.getInstance();
