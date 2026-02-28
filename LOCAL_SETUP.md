# 🚀 GameVibe AI - Complete Local Setup Guide

This guide will walk you through setting up the entire GameVibe AI project locally, including all services and dependencies.

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker)](#quick-start-docker)
3. [Manual Setup](#manual-setup)
4. [Environment Configuration](#environment-configuration)
5. [Running Services](#running-services)
6. [Testing Your Setup](#testing-your-setup)
7. [Common Issues](#common-issues)

## 📦 Prerequisites

### System Requirements
- **Node.js**: v20.0.0 or higher (LTS recommended)
- **pnpm**: v8.0.0 or higher
- **PostgreSQL**: v15 or higher
- **Redis**: v7 or higher
- **Docker & Docker Compose**: (optional, for containerized setup)
- **Git**: For cloning the repository
- **RAM**: Minimum 8GB recommended
- **Disk Space**: At least 2GB free

### Required Accounts
- **Discord Developer Account**: For bot token and application
- **Anthropic API**: For Claude AI models
- **OpenAI API**: For GPT models and DALL-E
- **Stripe Account**: For subscription management (optional for basic testing)

## 🐳 Quick Start (Docker)

The fastest way to get started is using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/your-username/gamevibe-ai.git
cd gamevibe-ai

# Copy environment template
cp .env.example .env

# Edit .env with your credentials (see Environment Configuration section)
nano .env  # or use your preferred editor

# Start all services
docker-compose up

# To run in background
docker-compose up -d

# View logs
docker-compose logs -f
```

## 🛠️ Manual Setup

### Step 1: Install Dependencies

```bash
# Install pnpm globally if not already installed
npm install -g pnpm

# Clone and enter the repository
git clone https://github.com/your-username/gamevibe-ai.git
cd gamevibe-ai

# Install all dependencies
pnpm install
```

### Step 2: Set Up Databases

#### PostgreSQL Setup
```bash
# macOS (using Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb gamevibe

# Or using psql
psql -U postgres
CREATE DATABASE gamevibe;
\q
```

#### Redis Setup
```bash
# macOS (using Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server

# Test Redis connection
redis-cli ping
# Should return: PONG
```

### Step 3: Environment Configuration

Create your `.env` file:
```bash
cp .env.example .env
```

Edit `.env` with your actual values:

#### Essential Variables (Required)
```env
# Discord Bot Configuration
DISCORD_TOKEN=your_bot_token_here              # From Discord Developer Portal
DISCORD_CLIENT_ID=your_client_id_here          # From Discord Developer Portal
DISCORD_PUBLIC_KEY=your_public_key_here        # From Discord Developer Portal
DEVELOPMENT_GUILD_ID=your_test_server_id       # Your test server ID

# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gamevibe
REDIS_URL=redis://localhost:6379

# AI Services (At least one required)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx          # From Anthropic Console
OPENAI_API_KEY=sk-xxxxx                       # From OpenAI Platform

# Web Runtime (for Discord Activities)
WEB_RUNTIME_URL=http://localhost:3001
APP_URL=http://localhost:3000

# Security
JWT_SECRET=generate_a_random_32_char_string_here
```

#### Optional Variables
```env
# Stripe (for subscriptions)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Asset Storage (for production)
S3_BUCKET=gamevibe-assets
S3_REGION=us-east-1
S3_ACCESS_KEY=xxxxx
S3_SECRET_KEY=xxxxx

# Development Mode
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_ASSET_GENERATION=false
USE_MOCK_ASSETS=true
```

### Step 4: Database Setup

```bash
# Generate Prisma client
pnpm --filter @gamevibe/bot run db:generate

# Run database migrations
pnpm --filter @gamevibe/bot run db:migrate

# (Optional) Open Prisma Studio to view database
pnpm --filter @gamevibe/bot run db:studio
```

### Step 5: Discord Bot Setup

1. **Create a Discord Application**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application" and name it (e.g., "GameVibe AI Dev")
   - Go to "Bot" section
   - Click "Add Bot"
   - Copy the bot token to your `.env` file

2. **Configure Bot Permissions**:
   - In the "OAuth2" > "URL Generator" section
   - Select scopes: `bot`, `applications.commands`
   - Select permissions:
     - Send Messages
     - Manage Messages
     - Embed Links
     - Attach Files
     - Read Message History
     - Use Slash Commands
     - Create Instant Invites (for Activities)

3. **Invite Bot to Your Server**:
   - Copy the generated OAuth2 URL
   - Open in browser and select your test server

## 🏃 Running Services

### Option 1: Run All Services (Recommended)

Open 4 terminal windows/tabs:

**Terminal 1 - Discord Bot**:
```bash
pnpm --filter @gamevibe/bot run dev
```

**Terminal 2 - Web Runtime** (for Discord Activities):
```bash
pnpm --filter @gamevibe/web-runtime run dev
```

**Terminal 3 - Multiplayer Server**:
```bash
pnpm --filter @gamevibe/multiplayer-server run dev
```

**Terminal 4 - Showcase Portal** (optional):
```bash
pnpm --filter @gamevibe/showcase-portal run dev
```

### Option 2: Using PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'gamevibe-bot',
      script: 'pnpm',
      args: '--filter @gamevibe/bot run dev',
      cwd: './',
    },
    {
      name: 'gamevibe-web',
      script: 'pnpm',
      args: '--filter @gamevibe/web-runtime run dev',
      cwd: './',
    },
    {
      name: 'gamevibe-multiplayer',
      script: 'pnpm',
      args: '--filter @gamevibe/multiplayer-server run dev',
      cwd: './',
    },
  ],
};
EOF

# Start all services
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Stop all services
pm2 stop all
```

### Option 3: Using Bash Script

```bash
# Create start script
cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "Starting GameVibe AI services..."

# Start services in background
pnpm --filter @gamevibe/bot run dev &
BOT_PID=$!

pnpm --filter @gamevibe/web-runtime run dev &
WEB_PID=$!

pnpm --filter @gamevibe/multiplayer-server run dev &
MP_PID=$!

echo "Services started:"
echo "Bot PID: $BOT_PID"
echo "Web Runtime PID: $WEB_PID"
echo "Multiplayer PID: $MP_PID"

# Wait for any process to exit
wait

# Kill all processes on exit
trap "kill $BOT_PID $WEB_PID $MP_PID" EXIT
EOF

chmod +x start-dev.sh
./start-dev.sh
```

## ✅ Testing Your Setup

### 1. Verify Services Are Running

Check that all services are running:
- **Bot**: Should show "Bot is online!" in console
- **Web Runtime**: http://localhost:3001 should respond
- **Multiplayer**: ws://localhost:2567 should be listening
- **Portal**: http://localhost:3000 should show the website

### 2. Test Bot Commands

In your Discord server:
```
/create-game Create a simple platformer game

/leaderboard global

/credits balance

/help
```

### 3. Test Database Connection

```bash
# Run a simple database query
pnpm --filter @gamevibe/bot run db:studio
# Should open Prisma Studio at http://localhost:5555
```

### 4. Test Redis Connection

```bash
redis-cli
> ping
PONG
> exit
```

## 🔧 Common Issues

### Port Already in Use
```bash
# Find process using port (e.g., 3000)
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Database Connection Error
```bash
# Check PostgreSQL is running
pg_isready

# Check database exists
psql -U postgres -l | grep gamevibe

# Recreate database if needed
dropdb gamevibe
createdb gamevibe
pnpm --filter @gamevibe/bot run db:migrate
```

### Missing Dependencies
```bash
# Clear cache and reinstall
rm -rf node_modules
rm -rf packages/*/node_modules
pnpm install
```

### Discord Bot Not Responding
- Ensure bot token is correct in `.env`
- Check bot has proper permissions in server
- Verify slash commands are registered (wait 1-2 minutes after bot starts)

### Memory Issues During Development
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm --filter @gamevibe/bot run dev
```

## 🎯 Next Steps

1. **Create Your First Game**: Use `/create-game` command
2. **Explore Features**: Try `/help` to see all commands
3. **Check Monitoring**: Visit http://localhost:8080/metrics
4. **View Database**: Open Prisma Studio with `pnpm --filter @gamevibe/bot run db:studio`
5. **Read Documentation**: Check `docs/` folder for detailed guides

## 📚 Additional Resources

- [Discord Activities Setup](docs/discord-activities-setup.md)
- [Multiplayer Testing Guide](docs/multiplayer-testing.md)
- [API Documentation](docs/api-reference.md)
- [Deployment Guide](docs/deployment.md)

## 🆘 Getting Help

- Check `PROJECT_STATUS.md` for feature status
- Review `CHANGELOG.md` for recent changes
- Open an issue on GitHub for bugs
- Join our Discord server for community support

---

Happy gaming! 🎮✨