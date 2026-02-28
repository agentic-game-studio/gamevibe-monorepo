// Enhanced Credit Service
// Combines subscription credits (existing) with personal credits (new)

import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { CreditService } from './credit.js';
import { PersonalCreditService } from './personal-credits.js';
import { SubscriptionTier } from '../generated/prisma/index.js';

export interface CombinedCreditBalance {
  // Subscription credits (from server tier)
  subscriptionCredits: number;
  subscriptionTier: string;
  monthlyAllotment: number;
  nextReset: Date;
  
  // Personal credits (earned by user)
  personalCredits: number;
  creatorTier: string;
  totalEarned: number;
  
  // Combined
  totalAvailable: number;
  
  // Usage info
  canUseModel: (model: string) => boolean;
  modelCosts: Record<string, number>;
}

export interface CreditDeductionResult {
  success: boolean;
  subscriptionCreditsUsed: number;
  personalCreditsUsed: number;
  remainingBalance: number;
  error?: string;
}

@injectable()
export class EnhancedCreditService {
  constructor(
    @inject(TYPES.CreditService) private creditService: CreditService,
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService
  ) {}

  /**
   * Get combined credit balance for a user
   */
  async getCombinedBalance(userId: string, serverId: string): Promise<CombinedCreditBalance> {
    // Get subscription credits
    const subscriptionBalance = await this.creditService.getCreditBalance(userId, serverId);
    
    // Get personal credits
    const personalBalance = await this.personalCreditService.getPersonalCredits(userId);
    
    // Calculate total
    const totalAvailable = (subscriptionBalance?.availableCredits || 0) + personalBalance.balance;
    
    return {
      // Subscription info
      subscriptionCredits: subscriptionBalance?.availableCredits || 0,
      subscriptionTier: subscriptionBalance?.tier || 'FREE',
      monthlyAllotment: subscriptionBalance?.monthlyAllotment || 0,
      nextReset: subscriptionBalance?.nextReset || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      
      // Personal info
      personalCredits: personalBalance.balance,
      creatorTier: personalBalance.creatorTier,
      totalEarned: personalBalance.totalEarned,
      
      // Combined
      totalAvailable,
      
      // Helper functions
      canUseModel: (model: string) => this.canUseModel(subscriptionBalance?.tier || 'FREE', totalAvailable, model),
      modelCosts: this.getModelCosts()
    };
  }

  /**
   * Deduct credits for AI model usage
   * Prioritizes subscription credits over personal credits
   */
  async deductCredits(
    userId: string,
    serverId: string,
    amount: number,
    reason: string,
    metadata?: any
  ): Promise<CreditDeductionResult> {
    const balance = await this.getCombinedBalance(userId, serverId);
    
    // Check if sufficient total credits
    if (balance.totalAvailable < amount) {
      return {
        success: false,
        subscriptionCreditsUsed: 0,
        personalCreditsUsed: 0,
        remainingBalance: balance.totalAvailable,
        error: `Insufficient credits. Need ${amount}, have ${balance.totalAvailable}`
      };
    }
    
    let remainingToDeduct = amount;
    let subscriptionCreditsUsed = 0;
    let personalCreditsUsed = 0;
    
    // 1. Try to deduct from subscription credits first
    if (balance.subscriptionCredits > 0) {
      const subDeduction = Math.min(balance.subscriptionCredits, remainingToDeduct);
      
      // Use existing credit service for subscription credits
      const subResult = await this.creditService.deductCredits(
        userId,
        serverId,
        subDeduction,
        reason,
        metadata
      );
      
      if (subResult.success) {
        subscriptionCreditsUsed = subDeduction;
        remainingToDeduct -= subDeduction;
      }
    }
    
    // 2. Deduct remaining from personal credits
    if (remainingToDeduct > 0) {
      const personalResult = await this.personalCreditService.spendCredits(
        userId,
        remainingToDeduct,
        reason,
        serverId
      );
      
      if (personalResult) {
        personalCreditsUsed = remainingToDeduct;
        remainingToDeduct = 0;
      } else {
        // Rollback subscription deduction if personal credits fail
        if (subscriptionCreditsUsed > 0) {
          await this.creditService.addCredits(
            userId,
            serverId,
            subscriptionCreditsUsed,
            'Rollback failed deduction'
          );
        }
        
        return {
          success: false,
          subscriptionCreditsUsed: 0,
          personalCreditsUsed: 0,
          remainingBalance: balance.totalAvailable,
          error: 'Failed to deduct personal credits'
        };
      }
    }
    
    const newBalance = balance.totalAvailable - amount;
    
    return {
      success: true,
      subscriptionCreditsUsed,
      personalCreditsUsed,
      remainingBalance: newBalance
    };
  }

  /**
   * Check if user can use a specific AI model
   */
  canUseModel(tier: string, totalCredits: number, model: string): boolean {
    // Free tier can only use Haiku
    if (tier === 'FREE' && model !== 'claude-haiku') {
      // But can use personal credits for other models
      const modelCost = this.getModelCosts()[model] || 0;
      return totalCredits >= modelCost;
    }
    
    // Check tier access
    const tierAccess = {
      'FREE': ['claude-haiku'],
      'STARTER': ['claude-haiku', 'gpt-3.5-turbo'],
      'PRO': ['claude-haiku', 'gpt-3.5-turbo', 'claude-sonnet', 'gpt-4-turbo'],
      'ENTERPRISE': ['claude-haiku', 'gpt-3.5-turbo', 'claude-sonnet', 'gpt-4-turbo', 'claude-opus']
    };
    
    const allowedModels = tierAccess[tier as keyof typeof tierAccess] || [];
    return allowedModels.includes(model) || totalCredits >= this.getModelCosts()[model];
  }

  /**
   * Get model costs in credits (1 credit = 1 cent)
   */
  private getModelCosts(): Record<string, number> {
    return {
      'claude-haiku': 0, // Free for all tiers
      'gpt-3.5-turbo': 2, // ~150 credits per 1k tokens
      'claude-sonnet': 3, // ~300 credits per 1k tokens
      'gpt-4-turbo': 10, // ~1000 credits per 1k tokens
      'claude-opus': 15 // ~1500 credits per 1k tokens
    };
  }

  /**
   * Add personal credits (wrapper for personal credit service)
   */
  async addPersonalCredits(
    userId: string,
    amount: number,
    reason: any,
    metadata?: any
  ): Promise<boolean> {
    const result = await this.personalCreditService.earnCredits(
      userId,
      amount,
      reason,
      metadata
    );
    
    return result.success;
  }

  /**
   * Process game-related credit earnings
   */
  async processGameEvent(
    eventType: 'play' | 'share' | 'remix',
    gameId: string,
    userId: string,
    serverId: string
  ): Promise<void> {
    switch (eventType) {
      case 'play':
        await this.personalCreditService.processGamePlay(gameId, serverId);
        break;
        
      case 'share':
        // Will be implemented with share tracking
        break;
        
      case 'remix':
        // Award credits to original creator
        const game = await this.getGame(gameId);
        if (game) {
          await this.personalCreditService.earnCredits(
            game.creatorId,
            10,
            'ACHIEVEMENT' as any,
            { type: 'game_remixed', gameId, remixerId: userId }
          );
        }
        break;
    }
  }

  /**
   * Get credit usage statistics
   */
  async getCreditStats(userId: string, serverId: string, days: number = 30): Promise<any> {
    // Combine stats from both services
    const subscriptionStats = await this.creditService.getCreditUsageStats(userId, serverId, days);
    const personalStats = await this.getPersonalCreditStats(userId, days);
    
    return {
      subscription: subscriptionStats,
      personal: personalStats,
      combined: {
        totalCreditsUsed: subscriptionStats.totalCreditsUsed + personalStats.totalSpent,
        totalCreditsEarned: personalStats.totalEarned,
        netCredits: personalStats.totalEarned - personalStats.totalSpent,
        percentPersonal: personalStats.totalSpent / (subscriptionStats.totalCreditsUsed + personalStats.totalSpent) * 100
      }
    };
  }

  /**
   * Helper to get personal credit stats
   */
  private async getPersonalCreditStats(userId: string, days: number): Promise<any> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const transactions = await this.prisma.personalCreditTransaction.findMany({
      where: {
        userId,
        createdAt: { gte: since }
      }
    });
    
    const earned = transactions
      .filter(t => t.type === 'EARNED')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const spent = transactions
      .filter(t => t.type === 'SPENT')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const earningsByReason = transactions
      .filter(t => t.type === 'EARNED')
      .reduce((acc, t) => {
        const reason = t.earningReason || 'OTHER';
        acc[reason] = (acc[reason] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
    
    return {
      totalEarned: earned,
      totalSpent: spent,
      earningsByReason,
      transactionCount: transactions.length
    };
  }

  // Helper to get game (should be injected properly)
  private async getGame(gameId: string): Promise<any> {
    // This would use the proper game service
    return null;
  }

  // Prisma instance (should be injected)
  private get prisma() {
    return (this.creditService as any).prisma;
  }
}