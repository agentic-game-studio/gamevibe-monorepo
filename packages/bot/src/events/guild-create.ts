import { Client, Events, Guild } from 'discord.js';
import { Container } from 'inversify';
import { DatabaseService } from '../services/database.js';
import { AnalyticsService } from '../services/analytics.js';
import { PersonalCreditService } from '../services/personal-credits.js';
import { ServerReferralService } from '../services/server-referral.js';
import { TYPES } from '../types.js';

export class GuildCreateEvent {
  constructor(
    private client: Client,
    private container: Container
  ) {}
  
  register(): void {
    this.client.on(Events.GuildCreate, this.execute.bind(this));
  }
  
  private async execute(guild: Guild): Promise<void> {
    console.log(`📥 Joined new guild: ${guild.name} (${guild.id}) with ${guild.memberCount} members`);
    
    try {
      // Get services
      const database = this.container.get<DatabaseService>(TYPES.DatabaseService);
      const analytics = this.container.get<AnalyticsService>(TYPES.AnalyticsService);
      const personalCreditService = this.container.get<PersonalCreditService>(TYPES.PersonalCreditService);
      const serverReferralService = this.container.get<ServerReferralService>(TYPES.ServerReferralService);
      
      // Save guild to database
      await database.upsertServer({
        discordId: guild.id,
        name: guild.name,
        memberCount: guild.memberCount || 0
      });
      
      // Check if there's a referral code stored for this guild
      // In a production setup, this would be tracked during the OAuth flow
      const referralCode = await this.checkForReferralCode(guild.id);
      if (referralCode) {
        await this.processReferral(guild.id, referralCode, serverReferralService, analytics);
      }
      
      // Track analytics
      await analytics.track('guild_joined', {
        guildId: guild.id,
        guildName: guild.name,
        memberCount: guild.memberCount,
        region: guild.preferredLocale
      });
      
      // Send welcome message if we have permissions
      const systemChannel = guild.systemChannel;
      if (systemChannel && systemChannel.permissionsFor(guild.members.me!)?.has('SendMessages')) {
        const { EmbedBuilder } = await import('discord.js');
        
        const welcomeEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🎮 GameVibe AI is here!')
          .setDescription('Create amazing games instantly with AI!')
          .addFields(
            {
              name: '🚀 Getting Started',
              value: 'Use `/create-game` to create your first game or `/help` to see all commands.'
            },
            {
              name: '✨ Features',
              value: '• Create games with natural language\n• Play directly in Discord\n• Share and remix games\n• Earn credits for viral games\n• Leaderboards and stats'
            },
            {
              name: '💰 Earn Credits & Rewards',
              value: 'Use `/server-referral link` to get your referral link and earn rewards when other servers join!'
            },
            {
              name: '💬 Support',
              value: 'Need help? Join our [support server](https://discord.gg/gamevibe) or check out our [documentation](https://gamevibe.ai/docs).'
            }
          )
          .setFooter({ 
            text: 'Thank you for adding GameVibe!',
            iconURL: this.client.user?.displayAvatarURL()
          })
          .setTimestamp();
        
        try {
          await systemChannel.send({ embeds: [welcomeEmbed] });
        } catch (error) {
          console.error('Failed to send welcome message:', error);
        }
      }
      
    } catch (error) {
      console.error('Error handling guild join:', error);
    }
  }
  
  /**
   * Check if there's a referral code stored for this guild
   * In production, this would be tracked during the OAuth flow
   */
  private async checkForReferralCode(guildId: string): Promise<string | null> {
    // TODO: Implement proper referral tracking via OAuth callback
    // For now, return null - referrals would be tracked when bot is added via invite link
    return null;
  }
  
  /**
   * Process server referral
   */
  private async processReferral(
    guildId: string, 
    referralCode: string,
    serverReferralService: ServerReferralService,
    analytics: AnalyticsService
  ): Promise<void> {
    try {
      // Process the referral using the service
      const success = await serverReferralService.processInstallReferral(referralCode, guildId);
      
      if (success) {
        console.log(`✅ Processed referral ${referralCode} for guild ${guildId}`);
        
        // Track analytics
        await analytics.track('server_referral_processed', {
          referralCode,
          referredServerId: guildId,
          action: 'install'
        });
      } else {
        console.log(`❌ Failed to process referral ${referralCode} for guild ${guildId}`);
      }
    } catch (error) {
      console.error('Error processing referral:', error);
    }
  }
}