import { injectable, inject } from 'inversify';
import { Client, EmbedBuilder } from 'discord.js';
import { Logger } from '../utils/logger.js';
import { prisma } from '../utils/database.js';
import { BotConfig } from '@gamevibe/shared';
import { CacheService } from './cache.js';
import { PersonalCreditService } from './personal-credits.js';
import { TYPES } from '../types.js';
import { CreatorStatus, CreatorTier, ContentType } from '../generated/prisma/index.js';

interface CreatorApplication {
  bio: string;
  primaryPlatform: ContentType;
  platforms: ContentType[];
  socialLinks: Record<string, string>;
  totalViews: number;
  totalSubscribers: number;
  avgViewsPerVideo: number;
  engagementRate: number;
  applicationNotes?: string;
}

interface ContentSubmission {
  title: string;
  description?: string;
  contentType: ContentType;
  platform: string;
  contentUrl: string;
  thumbnailUrl?: string;
  featuredGameIds?: string[];
  referralCode?: string;
}

interface CreatorStats {
  totalEarnings: number;
  currentMonthEarnings: number;
  totalContent: number;
  totalViews: number;
  totalConversions: number;
  averageEngagement: number;
  tier: CreatorTier;
  commissionRate: number;
  nextTierRequirement?: string;
}

interface CreatorLeaderboard {
  userId: string;
  username: string;
  displayName?: string;
  tier: CreatorTier;
  totalEarnings: number;
  totalViews: number;
  contentCount: number;
  engagementRate: number;
  rank: number;
}

@injectable()
export class ContentCreatorService {
  private logger = new Logger('ContentCreatorService');

  constructor(
    @inject(TYPES.Config) private config: BotConfig,
    @inject(TYPES.CacheService) private cacheService: CacheService,
    @inject(TYPES.PersonalCreditService) private personalCreditService: PersonalCreditService,
    @inject(TYPES.DiscordClient) private discordClient: Client
  ) {}

  /**
   * Submit creator partnership application
   */
  async submitApplication(
    userId: string,
    username: string,
    application: CreatorApplication
  ): Promise<{ success: boolean; message: string; applicationId?: string }> {
    try {
      // Check if user already has an application or partnership
      const existing = await prisma.creatorPartnership.findUnique({
        where: { userId },
      });

      if (existing) {
        if (existing.status === CreatorStatus.PENDING) {
          return {
            success: false,
            message: 'You already have a pending application. Please wait for review.',
          };
        }
        if (existing.status === CreatorStatus.APPROVED) {
          return {
            success: false,
            message: 'You are already an approved creator partner!',
          };
        }
        if (existing.status === CreatorStatus.REJECTED) {
          // Allow reapplication after rejection
          await prisma.creatorPartnership.delete({
            where: { userId },
          });
        }
      }

      // Create new application
      const partnership = await prisma.creatorPartnership.create({
        data: {
          userId,
          username,
          bio: application.bio,
          primaryPlatform: application.primaryPlatform,
          platforms: application.platforms,
          socialLinks: application.socialLinks,
          totalViews: application.totalViews,
          totalSubscribers: application.totalSubscribers,
          avgViewsPerVideo: application.avgViewsPerVideo,
          engagementRate: application.engagementRate,
          applicationNotes: application.applicationNotes,
          status: CreatorStatus.PENDING,
        },
      });

      // Notify admins about new application
      await this.notifyAdminsNewApplication(partnership.id, username);

      this.logger.info(`New creator application submitted by ${username} (${userId})`);

      return {
        success: true,
        message: 'Your creator partnership application has been submitted! You will be notified when it is reviewed.',
        applicationId: partnership.id,
      };
    } catch (error) {
      this.logger.error('Failed to submit creator application:', error);
      return {
        success: false,
        message: 'Failed to submit application. Please try again later.',
      };
    }
  }

  /**
   * Get creator partnership status
   */
  async getCreatorStatus(userId: string): Promise<{
    hasPartnership: boolean;
    status?: CreatorStatus;
    tier?: CreatorTier;
    partnership?: any;
  }> {
    const partnership = await prisma.creatorPartnership.findUnique({
      where: { userId },
      include: {
        content: {
          orderBy: { publishedAt: 'desc' },
          take: 5,
        },
        earnings: {
          orderBy: { earnedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!partnership) {
      return { hasPartnership: false };
    }

    return {
      hasPartnership: true,
      status: partnership.status,
      tier: partnership.tier,
      partnership,
    };
  }

  /**
   * Approve creator application
   */
  async approveApplication(
    applicationId: string,
    approvedById: string,
    tier: CreatorTier = CreatorTier.BRONZE,
    commissionRate: number = 0.10,
    adminNotes?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const partnership = await prisma.creatorPartnership.findUnique({
        where: { id: applicationId },
        include: { user: true },
      });

      if (!partnership) {
        return { success: false, message: 'Application not found.' };
      }

      if (partnership.status !== CreatorStatus.PENDING) {
        return { success: false, message: 'Application has already been processed.' };
      }

      // Update application
      await prisma.creatorPartnership.update({
        where: { id: applicationId },
        data: {
          status: CreatorStatus.APPROVED,
          tier,
          commissionRate,
          approvedAt: new Date(),
          approvedById,
          adminNotes,
        },
      });

      // Award welcome bonus (500 personal credits)
      await this.personalCreditService.addCredits(
        partnership.userId,
        500,
        'Creator Partnership Welcome Bonus',
        'creator_welcome'
      );

      // Notify creator of approval
      await this.notifyCreatorApproval(partnership.userId, tier);

      this.logger.info(`Creator application approved: ${partnership.username} (${partnership.userId})`);

      return {
        success: true,
        message: `Creator application approved for ${partnership.username}!`,
      };
    } catch (error) {
      this.logger.error('Failed to approve creator application:', error);
      return {
        success: false,
        message: 'Failed to approve application. Please try again.',
      };
    }
  }

  /**
   * Reject creator application
   */
  async rejectApplication(
    applicationId: string,
    rejectedById: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const partnership = await prisma.creatorPartnership.findUnique({
        where: { id: applicationId },
      });

      if (!partnership) {
        return { success: false, message: 'Application not found.' };
      }

      if (partnership.status !== CreatorStatus.PENDING) {
        return { success: false, message: 'Application has already been processed.' };
      }

      // Update application
      await prisma.creatorPartnership.update({
        where: { id: applicationId },
        data: {
          status: CreatorStatus.REJECTED,
          adminNotes: reason,
        },
      });

      // Notify creator of rejection
      await this.notifyCreatorRejection(partnership.userId, reason);

      this.logger.info(`Creator application rejected: ${partnership.username} (${partnership.userId})`);

      return {
        success: true,
        message: `Creator application rejected for ${partnership.username}.`,
      };
    } catch (error) {
      this.logger.error('Failed to reject creator application:', error);
      return {
        success: false,
        message: 'Failed to reject application. Please try again.',
      };
    }
  }

  /**
   * Submit content by creator
   */
  async submitContent(
    creatorId: string,
    content: ContentSubmission
  ): Promise<{ success: boolean; message: string; contentId?: string }> {
    try {
      const partnership = await prisma.creatorPartnership.findUnique({
        where: { userId: creatorId },
      });

      if (!partnership || partnership.status !== CreatorStatus.APPROVED) {
        return {
          success: false,
          message: 'You must be an approved creator to submit content.',
        };
      }

      // Generate unique referral code if not provided
      const referralCode = content.referralCode || await this.generateReferralCode(creatorId);

      const createdContent = await prisma.creatorContent.create({
        data: {
          creatorId: partnership.id,
          title: content.title,
          description: content.description,
          contentType: content.contentType,
          platform: content.platform,
          contentUrl: content.contentUrl,
          thumbnailUrl: content.thumbnailUrl,
          featuredGameIds: content.featuredGameIds || [],
          referralCode,
        },
      });

      // Track content submission
      await this.trackContentSubmission(partnership.id, createdContent.id);

      this.logger.info(`Content submitted by creator ${partnership.username}: ${content.title}`);

      return {
        success: true,
        message: 'Content submitted successfully! It will be reviewed and verified.',
        contentId: createdContent.id,
      };
    } catch (error) {
      this.logger.error('Failed to submit content:', error);
      return {
        success: false,
        message: 'Failed to submit content. Please try again.',
      };
    }
  }

  /**
   * Get creator statistics
   */
  async getCreatorStats(userId: string): Promise<CreatorStats | null> {
    const partnership = await prisma.creatorPartnership.findUnique({
      where: { userId },
      include: {
        content: true,
        earnings: true,
      },
    });

    if (!partnership || partnership.status !== CreatorStatus.APPROVED) {
      return null;
    }

    const totalViews = partnership.content.reduce((sum, content) => sum + content.views, 0);
    const totalConversions = partnership.content.reduce((sum, content) => sum + content.conversions, 0);
    const totalEngagement = partnership.content.reduce((sum, content) => 
      sum + content.likes + content.comments + content.shares, 0);
    const averageEngagement = partnership.content.length > 0 ? 
      totalEngagement / partnership.content.length : 0;

    return {
      totalEarnings: partnership.totalEarnings,
      currentMonthEarnings: partnership.currentMonthEarnings,
      totalContent: partnership.content.length,
      totalViews,
      totalConversions,
      averageEngagement,
      tier: partnership.tier,
      commissionRate: partnership.commissionRate,
      nextTierRequirement: this.getNextTierRequirement(partnership.tier),
    };
  }

  /**
   * Get pending applications for admin review
   */
  async getPendingApplications(): Promise<any[]> {
    return prisma.creatorPartnership.findMany({
      where: { status: CreatorStatus.PENDING },
      orderBy: { appliedAt: 'asc' },
      include: {
        user: true,
      },
    });
  }

  /**
   * Get creator leaderboard
   */
  async getCreatorLeaderboard(limit: number = 10): Promise<CreatorLeaderboard[]> {
    const cacheKey = `creator:leaderboard:${limit}`;
    const cached = await this.cacheService.get<CreatorLeaderboard[]>(cacheKey);
    if (cached) return cached;

    const creators = await prisma.creatorPartnership.findMany({
      where: { status: CreatorStatus.APPROVED },
      include: {
        content: true,
        earnings: true,
      },
      orderBy: [
        { totalEarnings: 'desc' },
        { totalViews: 'desc' },
      ],
      take: limit,
    });

    const leaderboard: CreatorLeaderboard[] = creators.map((creator, index) => ({
      userId: creator.userId,
      username: creator.username,
      displayName: creator.displayName || undefined,
      tier: creator.tier,
      totalEarnings: creator.totalEarnings,
      totalViews: creator.content.reduce((sum, content) => sum + content.views, 0),
      contentCount: creator.content.length,
      engagementRate: creator.engagementRate,
      rank: index + 1,
    }));

    await this.cacheService.set(cacheKey, leaderboard, 300); // 5 min cache
    return leaderboard;
  }

  /**
   * Process referral conversion
   */
  async processReferralConversion(
    referralCode: string,
    conversionType: 'signup' | 'subscription',
    conversionValue: number
  ): Promise<void> {
    try {
      const content = await prisma.creatorContent.findFirst({
        where: { referralCode },
        include: { creator: true },
      });

      if (!content) {
        this.logger.warn(`Referral code not found: ${referralCode}`);
        return;
      }

      // Update content metrics
      await prisma.creatorContent.update({
        where: { id: content.id },
        data: {
          conversions: { increment: 1 },
        },
      });

      // Calculate commission
      const commissionAmount = Math.round(conversionValue * content.creator.commissionRate);

      // Create earning record
      await prisma.creatorEarning.create({
        data: {
          creatorId: content.creatorId,
          amount: commissionAmount,
          type: 'referral',
          description: `${conversionType} referral commission`,
          sourceType: 'content',
          sourceId: content.id,
          earnedAt: new Date(),
          periodStart: new Date(),
          periodEnd: new Date(),
          metadata: {
            referralCode,
            conversionType,
            conversionValue,
          },
        },
      });

      // Update creator totals
      await prisma.creatorPartnership.update({
        where: { id: content.creatorId },
        data: {
          totalEarnings: { increment: commissionAmount },
          currentMonthEarnings: { increment: commissionAmount },
        },
      });

      this.logger.info(`Processed referral conversion: ${referralCode} - $${commissionAmount / 100}`);
    } catch (error) {
      this.logger.error('Failed to process referral conversion:', error);
    }
  }

  /**
   * Update creator tier based on performance
   */
  async updateCreatorTier(creatorId: string): Promise<{ upgraded: boolean; newTier?: CreatorTier }> {
    try {
      const partnership = await prisma.creatorPartnership.findUnique({
        where: { id: creatorId },
        include: { content: true, earnings: true },
      });

      if (!partnership) return { upgraded: false };

      const totalViews = partnership.content.reduce((sum, content) => sum + content.views, 0);
      const totalEarnings = partnership.totalEarnings;
      const contentCount = partnership.content.length;

      let newTier = partnership.tier;

      // Tier upgrade logic
      if (totalViews >= 1000000 && totalEarnings >= 100000 && contentCount >= 50) {
        newTier = CreatorTier.DIAMOND;
      } else if (totalViews >= 500000 && totalEarnings >= 50000 && contentCount >= 25) {
        newTier = CreatorTier.PLATINUM;
      } else if (totalViews >= 100000 && totalEarnings >= 10000 && contentCount >= 10) {
        newTier = CreatorTier.GOLD;
      } else if (totalViews >= 50000 && totalEarnings >= 5000 && contentCount >= 5) {
        newTier = CreatorTier.SILVER;
      }

      if (newTier !== partnership.tier) {
        await prisma.creatorPartnership.update({
          where: { id: creatorId },
          data: { tier: newTier },
        });

        // Award tier upgrade bonus
        const bonusAmount = this.getTierUpgradeBonus(newTier);
        if (bonusAmount > 0) {
          await this.personalCreditService.addCredits(
            partnership.userId,
            bonusAmount,
            `Creator Tier Upgrade to ${newTier}`,
            'tier_upgrade'
          );
        }

        // Notify creator of upgrade
        await this.notifyCreatorTierUpgrade(partnership.userId, newTier);

        return { upgraded: true, newTier };
      }

      return { upgraded: false };
    } catch (error) {
      this.logger.error('Failed to update creator tier:', error);
      return { upgraded: false };
    }
  }

  /**
   * Private helper methods
   */
  private async generateReferralCode(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { discordId: userId },
    });
    
    const baseCode = `CC_${user?.username || 'USER'}_${Date.now()}`.toUpperCase();
    return baseCode.substring(0, 20); // Limit length
  }

  private async trackContentSubmission(creatorId: string, contentId: string): Promise<void> {
    // Track analytics event
    await prisma.analyticsEvent.create({
      data: {
        type: 'creator_content_submitted',
        metadata: {
          creatorId,
          contentId,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  private getNextTierRequirement(currentTier: CreatorTier): string {
    switch (currentTier) {
      case CreatorTier.BRONZE:
        return '50K views, $50 earnings, 5 content pieces for Silver';
      case CreatorTier.SILVER:
        return '100K views, $100 earnings, 10 content pieces for Gold';
      case CreatorTier.GOLD:
        return '500K views, $500 earnings, 25 content pieces for Platinum';
      case CreatorTier.PLATINUM:
        return '1M views, $1000 earnings, 50 content pieces for Diamond';
      case CreatorTier.DIAMOND:
        return 'Maximum tier achieved!';
      default:
        return 'Unknown tier';
    }
  }

  private getTierUpgradeBonus(tier: CreatorTier): number {
    switch (tier) {
      case CreatorTier.SILVER: return 1000;
      case CreatorTier.GOLD: return 2500;
      case CreatorTier.PLATINUM: return 5000;
      case CreatorTier.DIAMOND: return 10000;
      default: return 0;
    }
  }

  private async notifyAdminsNewApplication(applicationId: string, username: string): Promise<void> {
    // This would notify admin users about new applications
    // Implementation would depend on how admins are identified
    this.logger.info(`New creator application notification for ${username}`);
  }

  private async notifyCreatorApproval(userId: string, tier: CreatorTier): Promise<void> {
    try {
      const user = await this.discordClient.users.fetch(userId);
      
      const embed = new EmbedBuilder()
        .setTitle('🎉 Creator Partnership Approved!')
        .setDescription(
          `Congratulations! Your creator partnership application has been approved.\n\n` +
          `**Your Tier:** ${tier}\n` +
          `**Welcome Bonus:** 500 personal credits added to your account\n\n` +
          `You can now start submitting content and earning commissions!\n` +
          `Use \`/creator submit\` to submit your content.`
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await user.send({ embeds: [embed] });
    } catch (error) {
      this.logger.error('Failed to notify creator of approval:', error);
    }
  }

  private async notifyCreatorRejection(userId: string, reason?: string): Promise<void> {
    try {
      const user = await this.discordClient.users.fetch(userId);
      
      const embed = new EmbedBuilder()
        .setTitle('Creator Partnership Application')
        .setDescription(
          `Unfortunately, your creator partnership application was not approved at this time.\n\n` +
          (reason ? `**Reason:** ${reason}\n\n` : '') +
          `You can reapply in the future once you meet the requirements.\n` +
          `Feel free to reach out if you have questions!`
        )
        .setColor(0xff0000)
        .setTimestamp();

      await user.send({ embeds: [embed] });
    } catch (error) {
      this.logger.error('Failed to notify creator of rejection:', error);
    }
  }

  private async notifyCreatorTierUpgrade(userId: string, newTier: CreatorTier): Promise<void> {
    try {
      const user = await this.discordClient.users.fetch(userId);
      const bonusAmount = this.getTierUpgradeBonus(newTier);
      
      const embed = new EmbedBuilder()
        .setTitle('🚀 Creator Tier Upgraded!')
        .setDescription(
          `Congratulations! You've been upgraded to **${newTier}** tier!\n\n` +
          `**Upgrade Bonus:** ${bonusAmount} personal credits\n\n` +
          `Keep creating amazing content to reach the next tier!`
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await user.send({ embeds: [embed] });
    } catch (error) {
      this.logger.error('Failed to notify creator of tier upgrade:', error);
    }
  }
}