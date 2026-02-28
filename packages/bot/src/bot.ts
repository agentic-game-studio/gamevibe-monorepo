import { Client, GatewayIntentBits, REST, Routes, Partials } from 'discord.js';
import { Container } from 'inversify';
import { BotConfig } from '@gamevibe/shared';
import { getCommands } from './commands/index.js';
import { registerEvents } from './events/index.js';
import { setupServices } from './services/index.js';
import { HealthService } from './services/health.js';
import { SchedulerService } from './services/scheduler.js';
import { AchievementService } from './services/achievement.js';
import { BotListingService } from './services/bot-listing.js';
import { MonitoringHTTPServer } from './monitoring/http-server.js';
import { TelemetryService } from './monitoring/telemetry.js';
import { TYPES } from './types.js';

export class GameVibeBot {
  private client: Client;
  private container: Container;
  private rest: REST;
  private monitoringServer: MonitoringHTTPServer | null = null;
  private telemetryService: TelemetryService | null = null;
  
  constructor(private config: BotConfig) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
      ]
    });
    
    this.rest = new REST({ version: '10' }).setToken(this.config.discord.token);
    this.container = new Container();
    this.setupDependencyInjection();
  }
  
  private setupDependencyInjection(): void {
    // Register core dependencies
    this.container.bind<BotConfig>(TYPES.Config).toConstantValue(this.config);
    this.container.bind<Client>(TYPES.DiscordClient).toConstantValue(this.client);
    this.container.bind<REST>(TYPES.DiscordREST).toConstantValue(this.rest);
    
    // Setup services
    setupServices(this.container);
  }
  
  async start(): Promise<void> {
    try {
      // Initialize telemetry if enabled
      if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
        this.telemetryService = new TelemetryService();
        this.telemetryService.initialize({
          serviceName: 'gamevibe-bot',
          serviceVersion: process.env.npm_package_version || '0.1.0',
          otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
          environment: this.config.environment
        });
        this.telemetryService.start();
      }

      // Start monitoring HTTP server
      const monitoringPort = process.env.MONITORING_PORT ? parseInt(process.env.MONITORING_PORT) : 8080;
      
      this.monitoringServer = new MonitoringHTTPServer(this.container, monitoringPort);
      await this.monitoringServer.start();
      
      // Skip Discord authentication if flag is set (for testing)
      if (!process.env.SKIP_DISCORD_AUTH) {
        // Register slash commands
        await this.registerSlashCommands();
        
        // Setup event handlers
        registerEvents(this.client, this.container);
        
        // Login to Discord
        await this.client.login(this.config.discord.token);
      } else {
        console.log('⚠️ Skipping Discord authentication (SKIP_DISCORD_AUTH=true)');
      }
      
      // Start scheduler for subscription notifications
      const scheduler = this.container.get<SchedulerService>(TYPES.SchedulerService);
      scheduler.start();
      
      // Initialize achievements
      const achievementService = this.container.get<AchievementService>(TYPES.AchievementService);
      await achievementService.initializeAchievements();
      console.log('✅ Achievements initialized');
      
      // Start bot listing service if configured
      if (this.config.botListing?.topgg?.token || 
          this.config.botListing?.discordBotsGG?.token || 
          this.config.botListing?.discordBotList?.token) {
        const botListingService = this.container.get<BotListingService>(TYPES.BotListingService);
        await botListingService.start();
        console.log('✅ Bot listing service started');
      }
      
      console.log(`✅ Bot logged in as ${this.client.user?.tag}`);
    } catch (error) {
      console.error('Failed to start bot:', error);
      throw error;
    }
  }
  
  async stop(): Promise<void> {
    try {
      console.log('🔄 Shutting down GameVibe Bot...');
      
      // Stop scheduler
      try {
        const scheduler = this.container.get<SchedulerService>(TYPES.SchedulerService);
        scheduler.stop();
      } catch (error) {
        console.warn('Could not stop scheduler:', error);
      }
      
      // Stop bot listing service
      try {
        const botListingService = this.container.get<BotListingService>(TYPES.BotListingService);
        botListingService.stop();
      } catch (error) {
        console.warn('Could not stop bot listing service:', error);
      }
      
      // Stop monitoring server
      if (this.monitoringServer) {
        await this.monitoringServer.stop();
        this.monitoringServer = null;
      }
      
      // Stop telemetry
      if (this.telemetryService) {
        await this.telemetryService.stop();
        this.telemetryService = null;
      }
      
      // Destroy client connection
      await this.client.destroy();
      console.log('✅ Bot disconnected gracefully');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
  
  private async registerSlashCommands(): Promise<void> {
    try {
      const commands = getCommands(this.container);
      const commandData = commands.map(cmd => cmd.data.toJSON());
      
      if (this.config.environment === 'development') {
        // Register commands for a specific guild in development
        const guildId = process.env.DEVELOPMENT_GUILD_ID;
        if (guildId) {
          await this.rest.put(
            Routes.applicationGuildCommands(this.config.discord.clientId, guildId),
            { body: commandData }
          );
          console.log(`✅ Registered ${commandData.length} slash commands for guild ${guildId}`);
        } else {
          // Fallback to global commands if no guild ID specified
          await this.rest.put(
            Routes.applicationCommands(this.config.discord.clientId),
            { body: commandData }
          );
          console.log(`✅ Registered ${commandData.length} global slash commands (development fallback)`);
        }
      } else {
        // Register global commands in production
        await this.rest.put(
          Routes.applicationCommands(this.config.discord.clientId),
          { body: commandData }
        );
        console.log(`✅ Registered ${commandData.length} global slash commands`);
      }
    } catch (error) {
      console.error('Error registering slash commands:', error);
      throw error;
    }
  }
}