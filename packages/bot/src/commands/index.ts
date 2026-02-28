import { Container } from 'inversify';
import { CommandInteraction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import { CreateGameCommand } from './create-game.js';
import { CreateMultiplayerGameCommand } from './create-multiplayer-game.js';
import { JoinGameCommand } from './join-game.js';
import { HelpCommand } from './help.js';
import { LeaderboardCommand } from './leaderboard.js';
import { SubscriptionCommand } from './subscription.js';
import { RemixGameCommand } from './remix-game.js';
import { CreditsCommand } from './credits.js';
import { EnhancedCreditsCommand } from './enhanced-credits.js';
import { CreatorStatsCommand } from './creator-stats.js';
import { ShareCommand } from './share.js';
import { ServerReferralCommand } from './server-referral.js';
import { CreatorAnalyticsCommand } from './creator-analytics.js';
import { AchievementsCommand } from './achievements.js';
import { ChallengeCommand } from './challenge.js';
import { AmbassadorCommand } from './ambassador.js';
import { ViralMetricsCommand } from './viral-metrics.js';
import { ViralNotificationsCommand } from './viral-notifications.js';
import { LiveActivityCommand } from './live-activity.js';
import { DiscoverCommand } from './discover.js';
import { SocialPreviewCommand } from './social-preview.js';
import { EmbedCommand } from './embed.js';
import { ServerRankingsCommand } from './server-rankings.js';
import { SEOLandingPagesCommand } from './seo-landing-pages.js';
import { LimitedTimeEventsCommand } from './limited-time-events.js';
import { CreatorSpotlightsCommand } from './creator-spotlights.js';
import { SocialBadgesCommand } from './social-badges.js';
import { SocialMediaCommand } from './social-media.js';
import { CreatorCommand } from './creator.js';
import { voteCommand } from './vote.js';
import { TYPES } from '../types.js';

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute(interaction: CommandInteraction): Promise<void>;
}

export function setupCommandBindings(container: Container): void {
  // Only bind if not already bound
  if (!container.isBound(TYPES.CreateGameCommand)) {
    container.bind<CreateGameCommand>(TYPES.CreateGameCommand).to(CreateGameCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.CreateMultiplayerGameCommand)) {
    container.bind<CreateMultiplayerGameCommand>(TYPES.CreateMultiplayerGameCommand).to(CreateMultiplayerGameCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.JoinGameCommand)) {
    container.bind<JoinGameCommand>(TYPES.JoinGameCommand).to(JoinGameCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.HelpCommand)) {
    container.bind<HelpCommand>(TYPES.HelpCommand).to(HelpCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.LeaderboardCommand)) {
    container.bind<LeaderboardCommand>(TYPES.LeaderboardCommand).to(LeaderboardCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.SubscriptionCommand)) {
    container.bind<SubscriptionCommand>(TYPES.SubscriptionCommand).to(SubscriptionCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.RemixGameCommand)) {
    container.bind<RemixGameCommand>(TYPES.RemixGameCommand).to(RemixGameCommand).inSingletonScope();
  }
  // Use EnhancedCreditsCommand instead of CreditsCommand
  if (!container.isBound(TYPES.EnhancedCreditsCommand)) {
    container.bind<EnhancedCreditsCommand>(TYPES.EnhancedCreditsCommand).to(EnhancedCreditsCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.CreatorStatsCommand)) {
    container.bind<CreatorStatsCommand>(TYPES.CreatorStatsCommand).to(CreatorStatsCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.ShareCommand)) {
    container.bind<ShareCommand>(TYPES.ShareCommand).to(ShareCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.ServerReferralCommand)) {
    container.bind<ServerReferralCommand>(TYPES.ServerReferralCommand).to(ServerReferralCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.CreatorAnalyticsCommand)) {
    container.bind<CreatorAnalyticsCommand>(TYPES.CreatorAnalyticsCommand).to(CreatorAnalyticsCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.AchievementsCommand)) {
    container.bind<AchievementsCommand>(TYPES.AchievementsCommand).to(AchievementsCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.ChallengeCommand)) {
    container.bind<ChallengeCommand>(TYPES.ChallengeCommand).to(ChallengeCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.AmbassadorCommand)) {
    container.bind<AmbassadorCommand>(TYPES.AmbassadorCommand).to(AmbassadorCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.ViralMetricsCommand)) {
    container.bind<ViralMetricsCommand>(TYPES.ViralMetricsCommand).to(ViralMetricsCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.ViralNotificationsCommand)) {
    container.bind<ViralNotificationsCommand>(TYPES.ViralNotificationsCommand).to(ViralNotificationsCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.LiveActivityCommand)) {
    container.bind<LiveActivityCommand>(TYPES.LiveActivityCommand).to(LiveActivityCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.DiscoverCommand)) {
    container.bind<DiscoverCommand>(TYPES.DiscoverCommand).to(DiscoverCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.SocialPreviewCommand)) {
    container.bind<SocialPreviewCommand>(TYPES.SocialPreviewCommand).to(SocialPreviewCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.EmbedCommand)) {
    container.bind<EmbedCommand>(TYPES.EmbedCommand).to(EmbedCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.ServerRankingsCommand)) {
    container.bind<ServerRankingsCommand>(TYPES.ServerRankingsCommand).to(ServerRankingsCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.SEOLandingPagesCommand)) {
    container.bind<SEOLandingPagesCommand>(TYPES.SEOLandingPagesCommand).to(SEOLandingPagesCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.LimitedTimeEventsCommand)) {
    container.bind<LimitedTimeEventsCommand>(TYPES.LimitedTimeEventsCommand).to(LimitedTimeEventsCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.CreatorSpotlightsCommand)) {
    container.bind<CreatorSpotlightsCommand>(TYPES.CreatorSpotlightsCommand).to(CreatorSpotlightsCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.SocialBadgesCommand)) {
    container.bind<SocialBadgesCommand>(TYPES.SocialBadgesCommand).to(SocialBadgesCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.VoteCommand)) {
    container.bind<Command>(TYPES.VoteCommand).toConstantValue(voteCommand);
  }
  if (!container.isBound(TYPES.SocialMediaCommand)) {
    container.bind<SocialMediaCommand>(TYPES.SocialMediaCommand).to(SocialMediaCommand).inSingletonScope();
  }
  if (!container.isBound(TYPES.CreatorCommand)) {
    container.bind<CreatorCommand>(TYPES.CreatorCommand).to(CreatorCommand).inSingletonScope();
  }
}

export function getCommands(container: Container): Command[] {
  // Get command instances (bindings should already exist)
  return [
    container.get<CreateGameCommand>(TYPES.CreateGameCommand),
    container.get<CreateMultiplayerGameCommand>(TYPES.CreateMultiplayerGameCommand),
    container.get<JoinGameCommand>(TYPES.JoinGameCommand),
    container.get<HelpCommand>(TYPES.HelpCommand),
    container.get<LeaderboardCommand>(TYPES.LeaderboardCommand),
    container.get<SubscriptionCommand>(TYPES.SubscriptionCommand),
    container.get<RemixGameCommand>(TYPES.RemixGameCommand),
    container.get<EnhancedCreditsCommand>(TYPES.EnhancedCreditsCommand),
    container.get<CreatorStatsCommand>(TYPES.CreatorStatsCommand),
    container.get<ShareCommand>(TYPES.ShareCommand),
    container.get<ServerReferralCommand>(TYPES.ServerReferralCommand),
    container.get<CreatorAnalyticsCommand>(TYPES.CreatorAnalyticsCommand),
    container.get<AchievementsCommand>(TYPES.AchievementsCommand),
    container.get<ChallengeCommand>(TYPES.ChallengeCommand),
    container.get<AmbassadorCommand>(TYPES.AmbassadorCommand),
    container.get<ViralMetricsCommand>(TYPES.ViralMetricsCommand),
    container.get<ViralNotificationsCommand>(TYPES.ViralNotificationsCommand),
    container.get<LiveActivityCommand>(TYPES.LiveActivityCommand),
    container.get<DiscoverCommand>(TYPES.DiscoverCommand),
    container.get<SocialPreviewCommand>(TYPES.SocialPreviewCommand),
    container.get<EmbedCommand>(TYPES.EmbedCommand),
    container.get<ServerRankingsCommand>(TYPES.ServerRankingsCommand),
    container.get<SEOLandingPagesCommand>(TYPES.SEOLandingPagesCommand),
    container.get<LimitedTimeEventsCommand>(TYPES.LimitedTimeEventsCommand),
    container.get<CreatorSpotlightsCommand>(TYPES.CreatorSpotlightsCommand),
    container.get<SocialBadgesCommand>(TYPES.SocialBadgesCommand),
    container.get<Command>(TYPES.VoteCommand),
    container.get<SocialMediaCommand>(TYPES.SocialMediaCommand),
    container.get<CreatorCommand>(TYPES.CreatorCommand)
  ];
}