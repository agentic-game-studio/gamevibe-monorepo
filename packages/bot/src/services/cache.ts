import { injectable } from 'inversify';
import { generateCacheKey } from '@gamevibe/shared';

// Mock cache service until Redis is set up
@injectable()
export class CacheService {
  private cache: Map<string, { value: any; expiry: number }> = new Map();
  
  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value as T;
  }
  
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    const expiry = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiry });
    
    // Clean up expired entries periodically
    if (this.cache.size > 1000) {
      this.cleanup();
    }
  }
  
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
  
  async keys(pattern: string): Promise<string[]> {
    const keys = Array.from(this.cache.keys());
    
    if (pattern === '*') {
      return keys;
    }
    
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\[([^\]]+)\]/g, '[$1]');
    
    const regex = new RegExp(`^${regexPattern}$`);
    
    return keys.filter(key => regex.test(key));
  }
  
  async ping(): Promise<string> {
    return 'PONG';
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}