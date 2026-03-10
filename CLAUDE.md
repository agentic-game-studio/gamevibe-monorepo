# Ralph Agent Instructions

You are an autonomous coding agent working on a software project.

## Your Task

1. Read the PRD at `prd.json` (in the same directory as this file)
2. Read the progress log at `progress.txt` (check Codebase Patterns section first)
3. Check you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story
6. Run quality checks (e.g., typecheck, lint, test - use whatever your project requires)
7. Update CLAUDE.md files if you discover reusable patterns (see below)
8. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
9. Update the PRD to set `passes: true` for the completed story
10. Append your progress to `progress.txt`

## Progress Report Format

APPEND to progress.txt (never replace, always append):
```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered (e.g., "this codebase uses X for Y")
  - Gotchas encountered (e.g., "don't forget to update Z when changing W")
  - Useful context (e.g., "the evaluation panel is in component X")
---
```

The learnings section is critical - it helps future iterations avoid repeating mistakes and understand the codebase better.

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the TOP of progress.txt (create it if it doesn't exist). This section should consolidate the most important learnings:

```
## Codebase Patterns
- Example: Use `sql<number>` template for aggregations
- Example: Always use `IF NOT EXISTS` for migrations
- Example: Export types from actions.ts for UI components
```

Only add patterns that are **general and reusable**, not story-specific details.

## Update CLAUDE.md Files

Before committing, check if any edited files have learnings worth preserving in nearby CLAUDE.md files:

1. **Identify directories with edited files** - Look at which directories you modified
2. **Check for existing CLAUDE.md** - Look for CLAUDE.md in those directories or parent directories
3. **Add valuable learnings** - If you discovered something future developers/agents should know:
   - API patterns or conventions specific to that module
   - Gotchas or non-obvious requirements
   - Dependencies between files
   - Testing approaches for that area
   - Configuration or environment requirements

**Examples of good CLAUDE.md additions:**
- "When modifying X, also update Y to keep them in sync"
- "This module uses pattern Z for all API calls"
- "Tests require the dev server running on PORT 3000"
- "Field names must match the template exactly"

**Do NOT add:**
- Story-specific implementation details
- Temporary debugging notes
- Information already in progress.txt

Only update CLAUDE.md if you have **genuinely reusable knowledge** that would help future work in that directory.

## Quality Requirements

- ALL commits must pass your project's quality checks (typecheck, lint, test)
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns

## Browser Testing (If Available)

For any story that changes UI, verify it works in the browser if you have browser testing tools configured (e.g., via MCP):

1. Navigate to the relevant page
2. Verify the UI changes work as expected
3. Take a screenshot if helpful for the progress log

If no browser tools are available, note in your progress report that manual browser verification is needed.

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete and passing, reply with:
<promise>COMPLETE</promise>

If there are still stories with `passes: false`, end your response normally (another iteration will pick up the next story).

## Important

- Work on ONE story per iteration
- Commit frequently
- Keep CI green
- Read the Codebase Patterns section in progress.txt before starting

---

# GameVibe AI - Project Specific Instructions

This file provides additional guidance for working on the GameVibe AI project.

## Project Overview

GameVibe AI is both a Discord bot AND a web application for creating AI-powered games through natural language prompts. Games can be played directly in Discord via Discord Activities or on the web-based Showcase Portal, featuring leaderboards, player statistics, and social features.

## Project Status

**PRODUCTION READY** - All core features implemented and deployable via Docker.

### Key Features (February 2026)
- Content Creator Program with 5-tier partnership system
- Social Media Integration with auto-posting and analytics
- Bot Listing Optimization with vote rewards
- Viral Growth System with cross-server tracking
- Credit-Based AI Model System (95% cost reduction)
- Game Remixing with 14 modification templates
- Achievement System (18 achievements)
- Challenge System with credit wagering
- Ambassador System with 4-tier ranking
- Cross-Server Discovery and trending
- Social Preview Cards with auto-generated GIFs
- SEO Landing Pages for games
- Limited-Time Events and game jams
- Server Rankings with multi-category leaderboards
- CI/CD with GitHub Actions and automated testing
- Game Showcase Portal (Next.js 14)

## Architecture

Monorepo with pnpm workspaces:
- `packages/bot` - Discord bot with game creation commands
- `packages/ai-service` - MiniMax LLM integration for AI game generation
- `packages/asset-generator` - DALL-E 3 asset generation
- `packages/game-engine` - Phaser 3 game templates
- `packages/web-runtime` - Discord Activities runtime
- `packages/multiplayer-server` - Colyseus real-time server
- `packages/showcase-portal` - Next.js public website
- `packages/shared` - Common types and utilities
- `packages/game-api` - REST API for game generation
- `packages/contracts` - Ethereum smart contracts (Solidity)

## Tech Stack

- **Language**: TypeScript 5.8+
- **Runtime**: Node.js 20 LTS
- **Package Manager**: pnpm 10+ (monorepo)
- **Discord**: Discord.js v14 + Discord Embedded App SDK
- **Game Engine**: Phaser 3.70
- **AI/LLM**: MiniMax (primary) - Uses MiniMax-M2.5-Lightning model for cost-effective game generation
- **Asset Generation**: DALL-E 3, Sharp
- **Blockchain**: Ethereum + Solidity (smart contracts for game ownership)
- **Storage**: IPFS (Pinata) for game code/assets
- **Database**: PostgreSQL with Prisma ORM (off-chain data)
- **Cache**: Redis
- **Payments**: Stripe
- **Multiplayer**: Colyseus 0.16
- **Deployment**: Docker

## Development Commands

```bash
# Install all dependencies
pnpm install

# Start development
pnpm --filter @gamevibe/bot run dev
pnpm --filter @gamevibe/web-runtime run dev
pnpm --filter @gamevibe/multiplayer-server run dev
pnpm --filter @gamevibe/showcase-portal run dev

# Build and test
pnpm run build
pnpm run test
pnpm run lint
pnpm run typecheck

# Database
pnpm --filter @gamevibe/bot run db:generate
pnpm --filter @gamevibe/bot run db:migrate
```

## Production Deployment

```bash
# Start full environment
docker-compose up

# Build production images
docker build -f Dockerfile.bot -t gamevibe-bot .
docker build -f Dockerfile.web -t gamevibe-web .
```

## Discord Commands

| Command | Description |
|---------|-------------|
| `/create-game` | Create a single-player game |
| `/create-multiplayer-game` | Create multiplayer game room |
| `/join-game <code>` | Join multiplayer game |
| `/remix-game` | Browse, create, or view remixes |
| `/leaderboard` | View game/global leaderboards |
| `/share` | Share game and earn credits |
| `/subscription` | View/upgrade subscription |
| `/credits` | View/buy AI credits |
| `/enhanced-credits` | Combined credit balance |
| `/creator-stats` | Creator tier and earnings |
| `/achievements` | View achievements |
| `/challenge` | Create/accept challenges |
| `/ambassador` | Manage ambassadors |
| `/server-referral` | Server referral tracking |
| `/viral-metrics` | Viral growth analytics |
| `/viral-notifications` | Configure notifications |
| `/live-activity` | Real-time activity feed |
| `/discover` | Cross-server game discovery |
| `/social-preview` | Generate preview cards |
| `/embed` | Generate embeddable games |
| `/server-rankings` | Server leaderboards |
| `/seo-landing-pages` | Generate SEO pages |
| `/events` | Manage limited-time events |
| `/spotlights` | Creator spotlights |
| `/badges` | Achievement badges |
| `/creator` | Content creator program |
| `/vote` | Bot listing votes |

## Game Types

### Single-Player
- Platformer - Player movement, platforms, collectibles
- Endless Runner - Infinite scrolling with obstacles
- Puzzle - Match-3 style gameplay
- Adventure - Top-down exploration
- Shooter - Space-themed with enemies
- RPG - Role-playing game mechanics
- Tower Defense - Strategic tower placement

### Multiplayer
- Multiplayer Shooter - Real-time battles (up to 8 players)

## Key Files and Directories

```
packages/bot/
  src/
    index.ts                    # Bot entry point
    commands/                   # Discord commands (30+ commands)
    services/                   # Business logic services
    events/                     # Interaction handlers
    middleware/                 # Feature gating
    api/                        # REST endpoints
    config/                     # Configuration
    prisma/schema.prisma        # Database schema

packages/ai-service/src/         # AI game generation
packages/asset-generator/src/   # DALL-E asset generation
packages/game-engine/src/       # Phaser game templates
packages/web-runtime/src/      # Discord Activities runtime
packages/multiplayer-server/    # Colyseus server
packages/showcase-portal/       # Next.js website
packages/game-api/              # Game generation REST API
packages/contracts/             # Ethereum smart contracts
  src/GameRegistry.sol          # On-chain game registry
docker-compose.yml              # Full dev environment
.env                           # Environment variables
```

## Blockchain Architecture

### On-Chain (Ethereum)
- **GameRegistry.sol**: Stores IPFS CIDs of generated games on-chain
- Game metadata: `ipfsCid`, `creator`, `name`, `gameType`, `createdAt`
- Events: `GameRegistered`, `GameUpdated` for transparency

### Off-Chain
- **IPFS (Pinata)**: Actual game code and asset storage
- **PostgreSQL**: User data, leaderboards, off-chain metadata
- **Redis**: Caching for fast reads

### Data Flow
```
User → AI generates game → Upload to IPFS → Store IPFS CID on-chain
                                        ↓
                              Smart Contract emits GameRegistered event
                                        ↓
Game retrieved via: IPFS (content) + Contract (metadata/provenance)
```

### Optional On-Chain Registration
- Without wallet: game stored off-chain only
- With `creatorWallet`: game registered on Ethereum for ownership/provenance

## Environment Variables

```bash
# Discord
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_PUBLIC_KEY=your_public_key
DEVELOPMENT_GUILD_ID=your_guild_id

# Web Runtime
WEB_RUNTIME_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/gamevibe
REDIS_URL=redis://localhost:6379

# AI Services
MINIMAX_API_KEY=your_minimax_api_key

# IPFS (Pinata) - for on-chain game storage
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key

# Blockchain (Ethereum)
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/your_project_id
PRIVATE_KEY=your_wallet_private_key
GAME_REGISTRY_CONTRACT=0x...

# Multiplayer
MULTIPLAYER_PORT=2567
MULTIPLAYER_URL=ws://localhost:2567
JWT_SECRET=your_jwt_secret

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_STARTER_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_PRICE_ID=price_xxx
APP_URL=http://localhost:3000

# Cost Optimization
ENABLE_INTELLIGENT_CACHING=true
ENABLE_BATCH_PROCESSING=true
ENABLE_PROGRESSIVE_ENHANCEMENT=true

# Credit System
ENABLE_CREDIT_SYSTEM=true
DEFAULT_FREE_MODEL=MiniMax-M2.5-Lightning
ENFORCE_TIER_LIMITS=true
CREDIT_ROLLOVER_ENABLED=true

# Monitoring
MONITORING_PORT=8080
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Subscription Tiers

| Tier | Price | Games/Month | AI Model | Monthly Credits |
|------|-------|-------------|----------|-----------------|
| FREE | $0 | 3 | MiniMax-M2.5-Lightning | Unlimited |
| STARTER | $9.99 | 50 | MiniMax-M2.5-Lightning | $5 |
| PRO | $29.99 | 100 | MiniMax-M2.5-Lightning | $20 |
| ENTERPRISE | $99.99 | Unlimited | MiniMax-M2.5-Lightning | $100 |

Note: All tiers use MiniMax-M2.5-Lightning for significant cost savings over Claude/GPT.

## Discord Activities Setup

1. Deploy web runtime publicly (Vercel/Railway/VPS)
2. Configure Activity URL in Discord Developer Portal
3. Set `WEB_RUNTIME_URL` in `.env`
4. Test with `/create-game` command

## Testing

```bash
pnpm run test              # Unit tests
pnpm run test:coverage     # Coverage report
pnpm run test:integration # Integration tests
pnpm run test:e2e         # E2E tests
```

## Troubleshooting

- Run `pnpm install` after pulling changes
- Run `db:generate` after schema changes
- Check Docker logs: `docker-compose logs -f`
- Verify `.env` variables are set
- Ensure `WEB_RUNTIME_URL` is accessible for Discord Activities

## ES Modules

This project uses ES modules. All relative imports must include `.js` extensions. All packages have `"type": "module"` in package.json.

## Prisma

After schema changes:
```bash
npx prisma generate
```

For Docker, ensure binaryTargets includes `linux-musl-arm64-openssl-3.0.x`.
