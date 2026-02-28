# Changelog

All notable changes to GameVibe AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Game Remixing System 🔄
- **Complete game remixing and modification platform** with comprehensive community features
- **14 predefined modification templates** across 5 categories (style, mechanics, theme, difficulty, combinations)
- Discord command: `/remix-game` with 6 subcommands (browse, create, trending, templates, history, info)
- **Template-based modifications** for easy game customization without technical knowledge
- **Interactive version history** with detailed change tracking and creator attribution
- **Community discovery system** with trending remixes and algorithm-based ranking
- **Creator leaderboards** showcasing top remix creators and their statistics
- **Social features** including category browsing, personal remix management, and community stats
- **Comprehensive analytics dashboard** with remix metrics across multiple timeframes
- **Rich Discord UI** with interactive components, select menus, and navigation controls
- Database schema with `GameRemix` and `GameVersion` models for full relationship tracking
- Redis caching for performance optimization with appropriate TTL values
- Integration with subscription system for feature gating and usage tracking
- **GameRemixService** with 15+ methods for complete remix functionality
- **RemixTemplatesService** providing curated modification templates
- Real-time interaction handling with proper error management and user feedback

### Added - Subscription Notifications System 🔔
- **Comprehensive Discord notification system** for subscription lifecycle events
- **Trial ending warnings** sent to subscription managers 7-1 days before expiration
- **Payment failure alerts** with grace period tracking (4 attempts before disabling)
- **Usage limit warnings** automatically triggered at 80% and 95% capacity
- **Subscription activation celebrations** with tier benefits and server announcements
- **Payment recovery notifications** with links to update payment methods
- **Renewal reminders** sent weekly for upcoming subscription renewals
- **Rich Discord embeds** with action buttons and professional styling
- **Automated daily scheduling** via SchedulerService for proactive notifications
- **Smart targeting** - DMs to managers, server announcements for major events
- **Fallback handling** - server notifications when DMs are disabled
- Real-time webhook-triggered notifications for instant subscription alerts

### Added - Stripe Subscription System 💳
- **Server-based subscription model** with 4 tiers (Free, Starter, Pro, Enterprise)
- Discord command: `/subscription info|upgrade|manage` for subscription management
- **Stripe Integration** with secure webhook processing and customer portal
- **Feature Gating Middleware** automatically enforces subscription limits
- **Usage Tracking** for games created and assets generated with Redis caching
- **Subscription Portal API** for web-based subscription management
- Cost-optimized pricing based on AI/infrastructure expense analysis
- Database schema with subscription tables, usage logs, and billing history
- Real-time limit enforcement on game creation and asset generation
- Automatic upgrade prompts with user-friendly pricing information

### Added - Multiplayer Support 🎮
- **Real-time multiplayer gaming** with Colyseus WebSocket server
- New `packages/multiplayer-server` with complete room management
- Discord commands: `/create-multiplayer-game` and `/join-game`
- 6-character room codes for easy game sharing
- JWT authentication for secure player connections
- Support for up to 8 concurrent players per game
- Player synchronization (position, actions, scores)
- Multiplayer game templates (starting with shooter)
- Comprehensive GameVibe multiplayer API for game developers
- Multiplayer testing script and documentation
- Docker configuration for multiplayer server deployment

### Added - AI Asset Generation 🎨
- **AI-powered asset generation** using DALL-E 3 for sprites, backgrounds, and UI
- New `packages/asset-generator` with complete generation pipeline
- Automatic sprite optimization and multiple size variants (1x, 2x)
- S3-compatible storage integration with CDN support
- Comprehensive asset library management system
- Asset browsing and collection features
- Image processing pipeline with Sharp (optimization, format conversion)
- Sprite sheet generation for animated sprites
- Redis caching layer for asset metadata
- Integration with game generation flow
- Support for multiple asset types: sprites, backgrounds, UI elements, effects
- Placeholder asset fallback for development

### Added - Leaderboards
- Comprehensive leaderboards system with Discord commands
- Score tracking and ranking for all games
- Global leaderboard across all games
- Personal player statistics tracking
- REST API endpoints for score submission
- Redis caching for leaderboard performance
- Web runtime score submission integration
- Help command with leaderboard instructions
- API documentation for leaderboard endpoints

### Changed
- Enhanced `GameEngine` to automatically select multiplayer templates
- Updated web runtime with `MultiplayerManager` class
- Extended `GameLoader` with multiplayer event handlers
- Improved `UIManager` with multiplayer results screen
- Updated monitoring HTTP server to handle leaderboard API routes
- Enhanced web runtime API client with leaderboard methods
- Improved database service with proper Prisma client access
- Updated help command with new leaderboard commands
- Modified `GameGeneratorService` to integrate asset generation
- Updated game templates to support injected asset URLs
- Enhanced AI prompts to include asset information
- Added asset field to `GeneratedGame` interface

### Technical
- Added `SubscriptionNotifications` service for Discord messaging and alerts
- Added `SchedulerService` for automated daily notification checks
- Integrated notifications with all Stripe webhook events in `SubscriptionService`
- Added automatic usage warnings in subscription middleware
- Enhanced bot startup/shutdown to manage notification scheduler
- Added notification history tracking and manager assignment system
- Added `SubscriptionService` for Stripe integration and subscription management
- Added `SubscriptionChecker` middleware for feature gating and usage tracking
- Added `SubscriptionCommand` with interactive Discord UI components
- Added `StripeWebhookAPI` for secure webhook event processing
- Added `SubscriptionPortalAPI` for customer portal integration
- Database schema with enums, constraints, and foreign key relationships
- Added subscription tiers configuration with feature flags
- Integrated with existing game creation flow for usage recording
- Added `MultiplayerService` for room and authentication management
- Added Colyseus schema definitions for game state
- Integrated multiplayer client (colyseus.js) in web runtime
- Added `LeaderboardService` for score management
- Added `LeaderboardCommand` with three subcommands
- Added `LeaderboardAPI` for REST endpoints
- Added `AssetGeneratorService` with DALL-E 3 integration
- Added `AssetLibraryManager` for asset organization
- Added `AssetBrowser` for asset search and browsing
- Added image processors: `ImageOptimizer`, `SpriteSheetGenerator`, `ImageFormatter`
- Added `AssetInjector` utility for template asset injection
- Added `AssetGeneratorServiceWrapper` for bot integration
- Database schema already included leaderboard_entries table
- Type-safe implementation with TypeScript

### Documentation
- Added `docs/multiplayer-api.md` - Complete API reference
- Added `docs/multiplayer-testing.md` - Testing and troubleshooting guide
- Added `docs/multiplayer-implementation-summary.md` - Implementation details
- Updated CLAUDE.md with multiplayer architecture and commands
- Updated README.md with multiplayer examples
- Updated deployment guide with multiplayer server instructions

## [0.1.0] - 2024-01-24

### Added
- Initial release with core functionality
- Discord bot with slash commands
- AI-powered game generation (Claude & OpenAI)
- Phaser 3 game engine integration
- Multiple game templates (platformer, puzzle, RPG, shooter, endless runner)
- Discord Activities support
- Web runtime for in-Discord gameplay
- PostgreSQL database with Prisma ORM
- Redis caching
- Docker deployment configuration
- Health monitoring and metrics
- OpenTelemetry tracing

### Infrastructure
- Monorepo structure with pnpm workspaces
- TypeScript throughout
- ES modules configuration
- Production-ready Docker images
- Comprehensive documentation