import { Container } from 'inversify';
import { GameGeneratorService } from './game-generator.js';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { AssetService } from './asset.js';
import { AnalyticsService } from './analytics.js';
import { RateLimitService } from './rate-limit.js';
import { HealthService } from './health.js';
import { LeaderboardService } from './leaderboard.js';
import { MultiplayerService } from './multiplayer.js';
import { SubscriptionService } from './subscription.js';
import { SubscriptionChecker } from '../middleware/subscription-check.js';
import { SubscriptionNotifications } from './subscription-notifications.js';
import { SchedulerService } from './scheduler.js';
import { GameRemixService } from './game-remix.js';
import { IntelligentCacheService } from './intelligent-cache.js';
import { AIModelSelectorService } from './ai-model-selector.js';
import { AIServiceWrapper } from './ai-service-wrapper.js';
import { GameTemplateCacheService } from './game-template-cache.js';
import { AssetTemplateLibraryService } from './asset-template-library.js';
import { BatchAssetGeneratorService } from './batch-asset-generator.js';
import { CommunityAssetPoolService } from './community-asset-pool.js';
import { ProgressiveEnhancementService } from './progressive-enhancement.js';
import { CostMonitoringService } from './cost-monitoring.js';
import { CreditService } from './credit.js';
import { PersonalCreditService } from './personal-credits.js';
import { EnhancedCreditService } from './enhanced-credit.js';
import { GameTrackingService } from './game-tracking.js';
import { CreatorAnalyticsService } from './creator-analytics.js';
import { AchievementService } from './achievement.js';
import { ChallengeService } from './challenge.js';
import { AmbassadorService } from './ambassador.js';
import { ViralMetricsService } from './viral-metrics.js';
import { ServerReferralService } from './server-referral.js';
import { ViralNotificationService } from './viral-notifications.js';
import { LiveActivityService } from './live-activity.js';
import { CrossServerDiscoveryService } from './cross-server-discovery.js';
import { SocialPreviewService } from './social-preview.js';
import { EmbedService } from './embed.js';
import { ServerRankingService } from './server-rankings.js';
import { SEOLandingPageService } from './seo-landing-pages.js';
import { LimitedTimeEventService } from './limited-time-events.js';
import { CreatorSpotlightService } from './creator-spotlights.js';
import { SocialBadgeService } from './social-badges.js';
import { BotListingService } from './bot-listing.js';
import { SocialMediaService } from './social-media.js';
import { ContentCreatorService } from './content-creator.js';
import { AIService } from '@gamevibe/ai-service';
import { GameEngine } from '@gamevibe/game-engine';
import { BotConfig } from '@gamevibe/shared';
import { setupCommandBindings } from '../commands/index.js';
import { TYPES } from '../types.js';

export function setupServices(container: Container): void {
  // Get config
  const config = container.get<BotConfig>(TYPES.Config);
  
  // Bind services
  container.bind<GameGeneratorService>(TYPES.GameGeneratorService).to(GameGeneratorService).inSingletonScope();
  container.bind<DatabaseService>(TYPES.DatabaseService).to(DatabaseService).inSingletonScope();
  container.bind<CacheService>(TYPES.CacheService).to(CacheService).inSingletonScope();
  container.bind<AssetService>(TYPES.AssetService).to(AssetService).inSingletonScope();
  container.bind<AnalyticsService>(TYPES.AnalyticsService).to(AnalyticsService).inSingletonScope();
  container.bind<RateLimitService>(TYPES.RateLimitService).to(RateLimitService).inSingletonScope();
  container.bind<HealthService>(TYPES.HealthService).to(HealthService).inSingletonScope();
  container.bind<LeaderboardService>(TYPES.LeaderboardService).to(LeaderboardService).inSingletonScope();
  container.bind<MultiplayerService>(TYPES.MultiplayerService).to(MultiplayerService).inSingletonScope();
  container.bind<SubscriptionNotifications>(TYPES.SubscriptionNotifications).to(SubscriptionNotifications).inSingletonScope();
  container.bind<SubscriptionService>(TYPES.SubscriptionService).to(SubscriptionService).inSingletonScope();
  container.bind<SubscriptionChecker>(TYPES.SubscriptionChecker).to(SubscriptionChecker).inSingletonScope();
  container.bind<SchedulerService>(TYPES.SchedulerService).to(SchedulerService).inSingletonScope();
  container.bind<GameRemixService>(TYPES.GameRemixService).to(GameRemixService).inSingletonScope();
  
  // Bind cost optimization services
  container.bind<IntelligentCacheService>(TYPES.IntelligentCacheService).to(IntelligentCacheService).inSingletonScope();
  container.bind<AIModelSelectorService>(TYPES.AIModelSelectorService).to(AIModelSelectorService).inSingletonScope();
  container.bind<AIServiceWrapper>(TYPES.AIServiceWrapper).to(AIServiceWrapper).inSingletonScope();
  container.bind<GameTemplateCacheService>(TYPES.GameTemplateCacheService).to(GameTemplateCacheService).inSingletonScope();
  container.bind<AssetTemplateLibraryService>(TYPES.AssetTemplateLibraryService).to(AssetTemplateLibraryService).inSingletonScope();
  container.bind<BatchAssetGeneratorService>(TYPES.BatchAssetGeneratorService).to(BatchAssetGeneratorService).inSingletonScope();
  container.bind<CommunityAssetPoolService>(TYPES.CommunityAssetPoolService).to(CommunityAssetPoolService).inSingletonScope();
  container.bind<ProgressiveEnhancementService>(TYPES.ProgressiveEnhancementService).to(ProgressiveEnhancementService).inSingletonScope();
  container.bind<CostMonitoringService>(TYPES.CostMonitoringService).to(CostMonitoringService).inSingletonScope();
  container.bind<CreditService>(TYPES.CreditService).to(CreditService).inSingletonScope();
  
  // Bind personal credit services
  container.bind<PersonalCreditService>(TYPES.PersonalCreditService).to(PersonalCreditService).inSingletonScope();
  container.bind<EnhancedCreditService>(TYPES.EnhancedCreditService).to(EnhancedCreditService).inSingletonScope();
  container.bind<GameTrackingService>(TYPES.GameTrackingService).to(GameTrackingService).inSingletonScope();
  container.bind<CreatorAnalyticsService>(TYPES.CreatorAnalyticsService).to(CreatorAnalyticsService).inSingletonScope();
  container.bind<AchievementService>(TYPES.AchievementService).to(AchievementService).inSingletonScope();
  container.bind<ChallengeService>(TYPES.ChallengeService).to(ChallengeService).inSingletonScope();
  container.bind<AmbassadorService>(TYPES.AmbassadorService).to(AmbassadorService).inSingletonScope();
  container.bind<ViralMetricsService>(TYPES.ViralMetricsService).to(ViralMetricsService).inSingletonScope();
  container.bind<ServerReferralService>(TYPES.ServerReferralService).to(ServerReferralService).inSingletonScope();
  container.bind<ViralNotificationService>(TYPES.ViralNotificationService).to(ViralNotificationService).inSingletonScope();
  container.bind<LiveActivityService>(TYPES.LiveActivityService).to(LiveActivityService).inSingletonScope();
  container.bind<CrossServerDiscoveryService>(TYPES.CrossServerDiscoveryService).to(CrossServerDiscoveryService).inSingletonScope();
  container.bind<SocialPreviewService>(TYPES.SocialPreviewService).to(SocialPreviewService).inSingletonScope();
  container.bind<EmbedService>(TYPES.EmbedService).to(EmbedService).inSingletonScope();
  container.bind<ServerRankingService>(TYPES.ServerRankingService).to(ServerRankingService).inSingletonScope();
  container.bind<SEOLandingPageService>(TYPES.SEOLandingPageService).to(SEOLandingPageService).inSingletonScope();
  container.bind<LimitedTimeEventService>(TYPES.LimitedTimeEventService).to(LimitedTimeEventService).inSingletonScope();
  container.bind<CreatorSpotlightService>(TYPES.CreatorSpotlightService).to(CreatorSpotlightService).inSingletonScope();
  container.bind<SocialBadgeService>(TYPES.SocialBadgeService).to(SocialBadgeService).inSingletonScope();
  container.bind<BotListingService>(TYPES.BotListingService).to(BotListingService).inSingletonScope();
  container.bind<SocialMediaService>(TYPES.SocialMediaService).to(SocialMediaService).inSingletonScope();
  container.bind<ContentCreatorService>(TYPES.ContentCreatorService).to(ContentCreatorService).inSingletonScope();
  
  // Bind external services
  container.bind<GameEngine>(TYPES.GameEngine).toConstantValue(new GameEngine());
  
  // Create AI service with cache integration
  const cacheService = container.get<CacheService>(TYPES.CacheService);
  const aiService = new AIService({
    minimaxApiKey: config.ai.minimaxApiKey,
    redis: {
      get: <T>(key: string) => cacheService.get<T>(key),
      set: (key: string, value: any, ttl?: number) => cacheService.set(key, value, ttl)
    }
  });
  container.bind<AIService>(TYPES.AIService).toConstantValue(aiService);
  
  // Setup command bindings
  setupCommandBindings(container);
}

// Export singleton instances for use in API routes
let botListingServiceInstance: BotListingService | null = null;

export function getBotListingService(container: Container): BotListingService {
  if (!botListingServiceInstance) {
    botListingServiceInstance = container.get<BotListingService>(TYPES.BotListingService);
  }
  return botListingServiceInstance;
}

// Export for convenience in API routes
export { botListingServiceInstance as botListingService };