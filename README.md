# GameVibe AI

> AI-powered platform for creating games through natural language

GameVibe AI transforms your game ideas into playable experiences. Use it directly in Discord via Discord Activities or play on the web through the Showcase Portal. Simply describe your game vision, and watch as AI generates a fully functional game.

## Features

- **AI Game Generation** - Describe your game in plain English
- **AI Asset Generation** - Automatic sprites, backgrounds, UI using DALL-E 3
- **Game Remixing** - Clone and modify games with 14 templates
- **Discord Activities** - Games run natively in Discord
- **Web Portal** - Play games directly on the website
- **Multiple Game Types** - Platformers, runners, puzzles, adventures, shooters, RPG, tower defense
- **Multiplayer** - Real-time battles with up to 8 players
- **Leaderboards** - Track high scores and compete globally
- **Credit-Based AI** - Cost-effective MiniMax-powered generation
- **Subscriptions** - FREE, STARTER ($9.99), PRO ($29.99), ENTERPRISE ($99.99)
- **Community Features** - Achievements, challenges, ambassador program, viral growth

## Quick Start

```bash
# Clone and setup
git clone https://github.com/your-username/gamevibe-ai.git
cd gamevibe-ai

# Start with Docker
cp .env.example .env
# Edit .env with your API keys
docker-compose up
```

### Manual Setup

```bash
pnpm install
cp .env.example .env
# Edit .env file
pnpm --filter @gamevibe/bot run db:migrate
pnpm --filter @gamevibe/showcase-portal run dev  # Web app on http://localhost:3000
pnpm --filter @gamevibe/web-runtime run dev       # Game runtime on http://localhost:3001
```

**Prerequisites:** Node.js 20+, pnpm 10+, PostgreSQL, Redis

## Usage

### Web Portal
1. Open http://localhost:3000
2. Browse featured games or create your own
3. Click "Play" to launch any game

### Discord Bot
1. Invite the bot to your Discord server
2. Use `/create-game` command
3. Describe your game idea
4. Click "Play Now" to launch

### Example Commands

```
/create-game A space shooter where you pilot a ship and destroy asteroids
/create-multiplayer-game A competitive space battle for 4 players
/join-game ABC123
/remix-game browse
/leaderboard global
```

## How AI Game Generation Works

When you create a game, here's what happens:

1. **User Input** - You describe your game idea via `/create-game` command or web form
2. **AI Analysis** - MiniMax LLM analyzes your description and determines game type, mechanics, and requirements
3. **Game Spec Generation** - AI generates a detailed game specification (player controls, enemies, objectives, scoring)
4. **Code Generation** - Phaser 3 game code is generated from the spec
5. **Asset Generation** - DALL-E 3 generates sprites, backgrounds, and UI elements
6. **Game Ready** - Your playable game is created and stored

The AI uses tool calling to:
- Analyze game requirements from natural language
- Generate complete game code with proper Phaser 3 patterns
- Create game specifications that match your vision

### Quick Create Flow

```
User: /create-game "A platformer where you jump on platforms and collect coins"

    ↓
Bot analyzes description → AI determines: Platformer game type
    ↓
AI generates game spec → "Player sprite, platforms, collectible coins, gravity physics"
    ↓
Code generated → Phaser 3 platformer template with your mechanics
    ↓
Assets created → Custom sprites via DALL-E 3
    ↓
Game ready! → Playable via Discord Activity or web portal
```

## Supported Game Types

| Type | Description |
|------|-------------|
| Platformer | Side-scrolling with jumping, platforms, collectibles |
| Endless Runner | Infinite scrolling with obstacles |
| Puzzle | Match-3 style brain teasers |
| Adventure | Top-down exploration with NPCs |
| Shooter | Space combat with enemies and bosses |
| RPG | Role-playing with stats and quests |
| Tower Defense | Strategic tower placement |

## Subscription Tiers

| Tier | Price | Games/Month | AI Model |
|------|-------|-------------|----------|
| FREE | $0 | 3 | MiniMax-M2.5-Lightning |
| STARTER | $9.99 | 50 | MiniMax-M2.5-Lightning |
| PRO | $29.99 | 100 | MiniMax-M2.5-Lightning |
| ENTERPRISE | $99.99 | Unlimited | MiniMax-M2.5-Lightning |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GameVibe Platform                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Discord Bot          Web Portal (Next.js)                   │
│  (Discord.js)         ├── Browse games                      │
│  ├── Commands         ├── Create games                      │
│  └── Activities       ├── User profiles                     │
│                       └── Leaderboards                      │
│           │                          │                      │
│           └──────────┬───────────────┘                      │
│                      ▼                                      │
│              AI Service (MiniMax)                           │
│              └── Game Generation                            │
│                      │                                      │
│         ┌────────────┼────────────┐                        │
│         ▼            ▼            ▼                        │
│    Game Engine   Asset Gen    Multiplayer                  │
│    (Phaser 3)    (DALL-E 3)   (Colyseus)                  │
│                      │            │                         │
│                      └─────┬──────┘                         │
│                            ▼                                │
│                      PostgreSQL + Redis                      │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Backend**: TypeScript, Node.js, Discord.js
- **AI**: MiniMax (M2.5-Lightning model)
- **Game Engine**: Phaser 3.70
- **Web Framework**: Next.js 14 (Showcase Portal)
- **Database**: PostgreSQL + Prisma
- **Cache**: Redis
- **Payments**: Stripe
- **Multiplayer**: Colyseus
- **Deployment**: Docker

## Development

```bash
# Install and setup
pnpm install
pnpm --filter @gamevibe/bot run db:migrate

# Run all services
pnpm --filter @gamevibe/showcase-portal run dev     # Web app: http://localhost:3000
pnpm --filter @gamevibe/web-runtime run dev         # Game runtime: http://localhost:3001
pnpm --filter @gamevibe/multiplayer-server run dev  # Multiplayer: ws://localhost:2567

# Build and test
pnpm run build
pnpm run test
```

## Environment Variables

```bash
# Required
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
MINIMAX_API_KEY=your_minimax_api_key
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/gamevibe
REDIS_URL=redis://localhost:6379

# Web Portal
APP_URL=http://localhost:3000

# Web Runtime (for Discord Activities & web games)
WEB_RUNTIME_URL=http://localhost:3001

# Stripe (for subscriptions)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## Deployment

```bash
# Docker (full stack)
docker-compose up -d

# Build production images
docker build -f Dockerfile.bot -t gamevibe-bot .
docker build -f Dockerfile.web -t gamevibe-web .
```

For Discord Activities, deploy the web runtime publicly and configure the Activity URL in Discord Developer Portal.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and run tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Ralph Autonomous Agent (Development)

Ralph is an autonomous development agent for the **development team**, not for end users creating games. It automates feature development.

### Running Ralph (For Developers)

```bash
# Run Ralph agent manually (single iteration)
./ralph.sh

# Or invoke via Claude Code
claude --print --no-context "Working on GameVibe AI"
```

### Ralph Workflow

1. Agent reads `prd.json` for pending user stories
2. Agent checks `progress.txt` for codebase patterns
3. Agent picks highest priority story, implements it
4. Agent runs quality checks (typecheck, lint, test)
5. Agent commits with `feat: [Story ID] - [Story Title]`
6. Agent updates `prd.json` and appends to `progress.txt`

See `CLAUDE.md` for full Ralph agent instructions.

> **Note:** Ralph is separate from the game generation AI. End users create games using the MiniMax-powered AI (see "How AI Game Generation Works" above).
