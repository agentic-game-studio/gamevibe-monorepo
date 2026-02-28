import { injectable, inject } from 'inversify';
import { CacheService } from './cache.js';
import { DatabaseService } from './database.js';
import { TYPES } from '../types.js';
import { LIMITS } from '@gamevibe/shared';

@injectable()
export class RateLimitService {
  constructor(
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.DatabaseService) private db: DatabaseService
  ) {}
  
  async checkLimit(userId: string, serverId: string): Promise<boolean> {
    // Check user's premium status
    const user = await this.db.getUser(userId);
    const server = await this.db.getServer(serverId);
    
    const isPremium = (user?.premiumTier || 0) > 0 || (server?.premiumTier || 0) > 0;
    
    // Different rate limits for premium vs free users
    const limit = isPremium ? 5 : 1; // requests per minute
    const window = 60; // seconds
    
    const key = `ratelimit:${userId}:create-game`;
    const current = await this.cache.get<number>(key) || 0;
    
    if (current >= limit) {
      return false;
    }
    
    await this.cache.set(key, current + 1, window);
    return true;
  }
  
  async checkMonthlyLimit(userId: string, serverId: string): Promise<{ allowed: boolean; remaining: number }> {
    // Check monthly game creation limits
    const user = await this.db.getUser(userId);
    const server = await this.db.getServer(serverId);
    
    let monthlyLimit: number = LIMITS.FREE_GAMES_PER_MONTH;
    
    if (user?.premiumTier === 1 || server?.premiumTier === 1) {
      monthlyLimit = LIMITS.BASIC_GAMES_PER_MONTH;
    } else if (user?.premiumTier === 2 || server?.premiumTier === 2) {
      monthlyLimit = LIMITS.PRO_GAMES_PER_MONTH;
    } else if (user?.premiumTier === 3 || server?.premiumTier === 3) {
      monthlyLimit = LIMITS.ENTERPRISE_GAMES_PER_MONTH;
    }
    
    // Count games created this month
    const monthKey = `monthly:${userId}:${new Date().toISOString().substring(0, 7)}`;
    const monthlyCount = await this.cache.get<number>(monthKey) || 0;
    
    if (monthlyLimit === -1) {
      // Unlimited
      return { allowed: true, remaining: -1 };
    }
    
    if (monthlyCount >= monthlyLimit) {
      return { allowed: false, remaining: 0 };
    }
    
    // Increment count
    await this.cache.set(monthKey, monthlyCount + 1, 30 * 24 * 60 * 60); // 30 days
    
    return { allowed: true, remaining: monthlyLimit - monthlyCount - 1 };
  }
}