// GameVibe AI Scheduler Service
// Handles periodic tasks like subscription notifications

import { injectable, inject } from 'inversify';
import { Client } from 'discord.js';
import { SubscriptionService } from './subscription.js';
import { BotListingService } from './bot-listing.js';
import { SocialMediaService } from './social-media.js';
import { TYPES } from '../types.js';
import { prisma } from '../utils/database.js';
import { EmbedBuilder } from 'discord.js';

@injectable()
export class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];

  constructor(
    @inject(TYPES.SubscriptionService) private subscriptionService: SubscriptionService,
    @inject(TYPES.BotListingService) private botListingService: BotListingService,
    @inject(TYPES.SocialMediaService) private socialMediaService: SocialMediaService,
    @inject(TYPES.DiscordClient) private client: Client
  ) {}

  /**
   * Start all scheduled tasks
   */
  start(): void {
    console.log('🕐 Starting scheduled tasks...');

    // Check trial endings daily at 9 AM
    this.scheduleDaily(9, 0, async () => {
      console.log('⏰ Running trial ending checks...');
      await this.subscriptionService.checkTrialEndingNotifications();
    });

    // Check renewal reminders daily at 10 AM
    this.scheduleDaily(10, 0, async () => {
      console.log('🔄 Running renewal reminder checks...');
      await this.subscriptionService.checkRenewalReminders();
    });

    // Check vote reminders every 12 hours at 9 AM and 9 PM
    this.scheduleDaily(9, 0, async () => {
      console.log('🗳️ Running vote reminder checks...');
      await this.sendVoteReminders();
    });
    
    this.scheduleDaily(21, 0, async () => {
      console.log('🗳️ Running vote reminder checks...');
      await this.sendVoteReminders();
    });

    // Process scheduled social media posts every 15 minutes
    this.scheduleRepeating(15 * 60 * 1000, async () => {
      console.log('📱 Processing scheduled social media posts...');
      await this.processScheduledPosts();
    });

    // Post weekly highlights every Sunday at 6 PM
    this.scheduleWeekly(0, 18, 0, async () => {
      console.log('📊 Posting weekly highlights...');
      await this.socialMediaService.postWeeklyHighlights();
    });

    console.log('✅ Scheduled tasks started');
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    console.log('🛑 Stopping scheduled tasks...');
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('✅ Scheduled tasks stopped');
  }

  /**
   * Schedule a task to run daily at a specific time
   */
  private scheduleDaily(hour: number, minute: number, task: () => Promise<void>): void {
    const getNextRun = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(hour, minute, 0, 0);

      // If time has passed today, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      
      return next;
    };

    const runTask = async () => {
      try {
        await task();
      } catch (error) {
        console.error('Scheduled task error:', error);
      }
      
      // Schedule next run
      const nextRun = getNextRun();
      const delay = nextRun.getTime() - Date.now();
      
      const timeout = setTimeout(runTask, delay);
      this.intervals.push(timeout);
    };

    // Schedule first run
    const nextRun = getNextRun();
    const delay = nextRun.getTime() - Date.now();
    
    console.log(`📅 Scheduled task for ${nextRun.toLocaleString()}`);
    
    const timeout = setTimeout(runTask, delay);
    this.intervals.push(timeout);
  }

  /**
   * Schedule a task to run repeatedly at intervals
   */
  private scheduleRepeating(intervalMs: number, task: () => Promise<void>): void {
    const runTask = async () => {
      try {
        await task();
      } catch (error) {
        console.error('Scheduled task error:', error);
      }
    };

    // Don't run immediately - just schedule for intervals
    // runTask();

    // Schedule repeating runs
    const interval = setInterval(runTask, intervalMs);
    this.intervals.push(interval);
  }

  /**
   * Schedule a task to run weekly at a specific day and time
   * @param dayOfWeek 0 = Sunday, 1 = Monday, etc.
   * @param hour Hour in 24-hour format
   * @param minute Minute
   * @param task Task to run
   */
  private scheduleWeekly(dayOfWeek: number, hour: number, minute: number, task: () => Promise<void>): void {
    const getNextRun = () => {
      const now = new Date();
      const next = new Date();
      
      // Set to the desired time
      next.setHours(hour, minute, 0, 0);
      
      // Calculate days until target day of week
      const daysUntilTarget = (dayOfWeek + 7 - next.getDay()) % 7;
      
      if (daysUntilTarget === 0 && next <= now) {
        // If it's the same day but time has passed, schedule for next week
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + daysUntilTarget);
      }
      
      return next;
    };

    const runTask = async () => {
      try {
        await task();
      } catch (error) {
        console.error('Scheduled weekly task error:', error);
      }
      
      // Schedule next run
      const nextRun = getNextRun();
      const delay = nextRun.getTime() - Date.now();
      
      const timeout = setTimeout(runTask, delay);
      this.intervals.push(timeout);
    };

    // Schedule first run
    const nextRun = getNextRun();
    const delay = nextRun.getTime() - Date.now();
    
    console.log(`📅 Scheduled weekly task for ${nextRun.toLocaleString()}`);
    
    const timeout = setTimeout(runTask, delay);
    this.intervals.push(timeout);
  }

  /**
   * Process scheduled social media posts
   */
  private async processScheduledPosts(): Promise<void> {
    try {
      const now = new Date();
      
      // Get pending posts that are ready to be sent
      const readyPosts = await prisma.scheduledPost.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: {
            lte: now,
          },
        },
        take: 10, // Process in batches
      });

      for (const post of readyPosts) {
        try {
          // Mark as being processed
          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: { status: 'POSTED' }, // Optimistically mark as posted
          });

          let result;
          if (post.platform === 'TWITTER') {
            // Post to Twitter
            result = await this.socialMediaService.postToTwitter(
              post.content,
              post.mediaUrls,
              post.hashtags
            );
          } else if (post.platform === 'TIKTOK') {
            // Post to TikTok
            result = await this.socialMediaService.postToTikTok(
              post.content,
              post.mediaUrls[0] || '', // Video URL
              post.hashtags
            );
          }

          if (result?.success) {
            // Update with success details
            await prisma.scheduledPost.update({
              where: { id: post.id },
              data: {
                status: 'POSTED',
                postedAt: now,
                postId: result.postId,
                postUrl: result.url,
              },
            });
            console.log(`✅ Posted scheduled ${post.platform} post: ${post.id}`);
          } else {
            // Mark as failed
            await prisma.scheduledPost.update({
              where: { id: post.id },
              data: {
                status: 'FAILED',
                error: result?.error || 'Unknown error',
              },
            });
            console.error(`❌ Failed to post scheduled ${post.platform} post: ${result?.error}`);
          }
        } catch (error) {
          // Mark as failed
          await prisma.scheduledPost.update({
            where: { id: post.id },
            data: {
              status: 'FAILED',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          console.error(`❌ Error processing scheduled post ${post.id}:`, error);
        }
      }

      if (readyPosts.length > 0) {
        console.log(`✅ Processed ${readyPosts.length} scheduled posts`);
      }
    } catch (error) {
      console.error('Failed to process scheduled posts:', error);
    }
  }

  /**
   * Send vote reminders to users who have enabled them
   */
  private async sendVoteReminders(): Promise<void> {
    try {
      // Get users with vote reminders enabled who haven't voted in 12+ hours
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      
      const usersToRemind = await prisma.user.findMany({
        where: {
          preferences: {
            path: ['voteReminders'],
            equals: true,
          },
          AND: [
            {
              OR: [
                {
                  NOT: {
                    analyticsEvents: {
                      some: {
                        type: 'bot_vote',
                        createdAt: {
                          gte: twelveHoursAgo,
                        },
                      },
                    },
                  },
                },
                {
                  analyticsEvents: {
                    none: {
                      type: 'bot_vote',
                    },
                  },
                },
              ],
            },
          ],
        },
        take: 100, // Process in batches
      });

      const urls = this.botListingService.getBotListingUrls();
      
      for (const user of usersToRemind) {
        try {
          const discordUser = await this.client.users.fetch(user.discordId);
          
          const embed = new EmbedBuilder()
            .setTitle('🗳️ Time to Vote!')
            .setDescription(
              'You can vote for GameVibe AI again and earn credits!\n\n' +
              '🎁 **Earn 10 credits per vote** (20 on weekends!)\n' +
              'Your support helps more people discover GameVibe AI.'
            )
            .setColor(0x00ff00)
            .addFields(
              {
                name: 'Quick Vote Links',
                value: 
                  `[Vote on Top.gg](${urls.topgg})\n` +
                  `[Vote on Discord.bots.gg](${urls.discordBotsGG})\n` +
                  `[Vote on Discordbotlist](${urls.discordBotList})`,
                inline: false,
              },
              {
                name: 'Disable Reminders',
                value: 'Use `/vote remind` to turn off these reminders.',
                inline: false,
              }
            )
            .setFooter({ text: 'Thank you for supporting GameVibe AI!' })
            .setTimestamp();

          await discordUser.send({ embeds: [embed] });
          
          // Log reminder sent
          await prisma.analyticsEvent.create({
            data: {
              type: 'vote_reminder_sent',
              userId: user.discordId,
              metadata: {
                timestamp: new Date().toISOString(),
              },
            },
          });
        } catch (error) {
          console.error(`Failed to send vote reminder to user ${user.discordId}:`, error);
        }
      }
      
      console.log(`✅ Sent vote reminders to ${usersToRemind.length} users`);
    } catch (error) {
      console.error('Failed to send vote reminders:', error);
    }
  }
}