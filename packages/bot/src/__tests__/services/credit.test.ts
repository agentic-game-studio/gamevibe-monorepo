import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreditService } from '../../services/credit.js';
import { createMockDatabase, createMockCache, setupCommonMocks } from '../utils/test-helpers.js';

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn(() => ({
      checkout: {
        sessions: {
          create: vi.fn(),
        },
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    })),
  };
});

describe('CreditService', () => {
  let service: CreditService;
  let mockDatabase: any;
  let mockCache: any;
  const serverId = '123456789';
  const userId = '987654321';

  beforeEach(() => {
    vi.clearAllMocks();
    setupCommonMocks();
    
    mockDatabase = createMockDatabase();
    mockCache = createMockCache();
    
    // Create service instance using DI-compatible approach
    service = new CreditService(mockDatabase, mockCache);
  });

  describe('getCreditBalance', () => {
    it('should return existing server credits', async () => {
      const mockBalance = {
        userId,
        serverId,
        totalCredits: 5000,
        availableCredits: 3000,
        monthlyAllotment: 2000,
        tier: 'PRO',
        rolloverCredits: 1000,
        lastUpdated: new Date(),
        nextReset: new Date(),
      };
      
      mockCache.get.mockResolvedValue(null);
      mockDatabase.prisma.creditBalance.findUnique.mockResolvedValue(mockBalance);

      const result = await service.getCreditBalance(userId, serverId);

      expect(result).toEqual(mockBalance);
      expect(mockDatabase.prisma.creditBalance.findUnique).toHaveBeenCalledWith({
        where: { userId_serverId: { userId, serverId } },
      });
    });

    it('should create new server credits for FREE tier if not found', async () => {
      mockCache.get.mockResolvedValue(null);
      mockDatabase.prisma.creditBalance.findUnique.mockResolvedValue(null);
      
      const newBalance = {
        userId,
        serverId,
        totalCredits: 0,
        availableCredits: 0,
        monthlyAllotment: 0,
        tier: 'FREE',
        rolloverCredits: 0,
        lastUpdated: new Date(),
        nextReset: new Date(),
      };
      mockDatabase.prisma.creditBalance.create.mockResolvedValue(newBalance);

      const result = await service.getCreditBalance(userId, serverId);

      expect(result?.tier).toBe('FREE');
      expect(mockDatabase.prisma.creditBalance.create).toHaveBeenCalled();
    });
  });

  describe('hasCredits', () => {
    it('should check if user has sufficient credits', async () => {
      const mockBalance = {
        userId,
        serverId,
        availableCredits: 5000,
        tier: 'PRO',
        totalCredits: 10000,
        monthlyAllotment: 2000,
        rolloverCredits: 0,
        lastUpdated: new Date(),
        nextReset: new Date(),
      };
      
      mockCache.get.mockResolvedValue(null);
      mockDatabase.prisma.creditBalance.findUnique.mockResolvedValue(mockBalance);

      const result = await service.hasCredits(userId, serverId, 'claude-sonnet', 1000);

      expect(result.hasCredits).toBe(true);
      expect(result.cost).toBe(300); // $3 for 1000 tokens of Claude Sonnet
      expect(result.balance).toBe(5000);
    });

    it('should allow free Haiku for FREE tier', async () => {
      const mockBalance = {
        userId,
        serverId,
        availableCredits: 0,
        tier: 'FREE',
        totalCredits: 0,
        monthlyAllotment: 0,
        rolloverCredits: 0,
        lastUpdated: new Date(),
        nextReset: new Date(),
      };
      
      mockCache.get.mockResolvedValue(null);
      mockDatabase.prisma.creditBalance.findUnique.mockResolvedValue(mockBalance);

      const result = await service.hasCredits(userId, serverId, 'claude-haiku', 1000);

      expect(result.hasCredits).toBe(true);
      expect(result.cost).toBe(0);
    });
  });

  describe('deductCredits', () => {
    it('should deduct credits successfully', async () => {
      const mockBalance = {
        userId,
        serverId,
        availableCredits: 5000,
        totalCredits: 10000,
        tier: 'PRO',
        monthlyAllotment: 2000,
        rolloverCredits: 0,
        lastUpdated: new Date(),
        nextReset: new Date(),
      };
      
      mockCache.get.mockResolvedValue(null);
      mockDatabase.prisma.creditBalance.findUnique.mockResolvedValue(mockBalance);
      mockDatabase.prisma.creditBalance.update.mockResolvedValue({
        ...mockBalance,
        availableCredits: 4900,
      });
      mockDatabase.prisma.creditTransaction.create.mockResolvedValue({
        id: 'tx-123',
        userId,
        serverId,
        type: 'deduction',
        amount: 300,
        model: 'claude-sonnet',
        description: 'AI model usage: claude-sonnet',
        balanceBefore: 5000,
        balanceAfter: 4700,
        tokensUsed: 1000,
        createdAt: new Date(),
      });

      const result = await service.deductCredits(userId, serverId, 'claude-sonnet', 1000);

      expect(result).toBeTruthy();
      expect(result?.amount).toBe(300); // $3 for 1000 tokens of Claude Sonnet
      expect(mockDatabase.prisma.creditBalance.update).toHaveBeenCalled();
    });

    it('should fail if insufficient credits', async () => {
      const mockBalance = {
        userId,
        serverId,
        availableCredits: 10,
        totalCredits: 10,
        tier: 'STARTER',
        monthlyAllotment: 500,
        rolloverCredits: 0,
        lastUpdated: new Date(),
        nextReset: new Date(),
      };
      
      mockCache.get.mockResolvedValue(null);
      mockDatabase.prisma.creditBalance.findUnique.mockResolvedValue(mockBalance);

      const result = await service.deductCredits(userId, serverId, 'gpt-3.5-turbo', 10000);

      expect(result).toBeNull();
    });
  });

  describe('getCreditUsageStats', () => {
    it('should return comprehensive usage statistics', async () => {
      const mockBalance = {
        userId,
        serverId,
        availableCredits: 3000,
        totalCredits: 5000,
        monthlyAllotment: 2000,
        tier: 'PRO',
        rolloverCredits: 1000,
        lastUpdated: new Date(),
        nextReset: new Date(),
      };
      
      mockCache.get.mockResolvedValue(null);
      mockDatabase.prisma.creditBalance.findUnique.mockResolvedValue(mockBalance);
      mockDatabase.prisma.creditTransaction.findMany.mockResolvedValue([
        {
          model: 'gpt-4',
          amount: 100,
          tokensUsed: 1000,
          createdAt: new Date(),
        },
        {
          model: 'claude-sonnet',
          amount: 200,
          tokensUsed: 2000,
          createdAt: new Date(),
        },
      ]);
      mockDatabase.prisma.creditTransaction.aggregate.mockResolvedValue({
        _sum: { amount: 2000 },
        _count: 10,
      });

      const result = await service.getCreditUsageStats(userId, serverId, 30);

      expect(result.totalCreditsUsed).toBe(300); // 100 + 200 from transactions
      expect(result.creditsUsedByModel).toBeDefined();
      expect(result.creditsUsedByModel['gpt-4']).toBe(100);
      expect(result.creditsUsedByModel['claude-sonnet']).toBe(200);
      expect(result.recommendedTier).toBe('STARTER'); // 300 credits/month is only $3, fits in STARTER tier
    });
  });
});