#!/bin/bash

# GameVibe AI - Local Setup Script
# This script helps set up the project for local development

set -e

echo "🎮 GameVibe AI - Local Setup Script"
echo "===================================="
echo ""

# Check Node.js version
echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version 20+ required. Current version: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi
echo "✅ pnpm $(pnpm -v)"

# Check PostgreSQL
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL detected"
else
    echo "⚠️  PostgreSQL not found. Please install it manually or use Docker."
fi

# Check Redis
if command -v redis-cli &> /dev/null; then
    echo "✅ Redis detected"
else
    echo "⚠️  Redis not found. Please install it manually or use Docker."
fi

echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🔧 Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo "⚠️  Please edit .env and add your API keys and tokens"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🗄️  Setting up database..."
echo "Do you want to set up the database now? (y/n)"
read -r SETUP_DB

if [ "$SETUP_DB" = "y" ]; then
    # Check if database exists
    if psql -U postgres -lqt | cut -d \| -f 1 | grep -qw gamevibe; then
        echo "✅ Database 'gamevibe' already exists"
    else
        echo "Creating database..."
        createdb gamevibe || echo "⚠️  Could not create database. You may need to do this manually."
    fi
    
    echo "Running database migrations..."
    pnpm --filter @gamevibe/bot run db:generate
    pnpm --filter @gamevibe/bot run db:migrate
    echo "✅ Database setup complete"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env file with your API keys and Discord bot token"
echo "2. Create a Discord application at https://discord.com/developers/applications"
echo "3. Invite the bot to your server"
echo "4. Run the services:"
echo ""
echo "   # Option 1: Run all services in separate terminals"
echo "   pnpm --filter @gamevibe/bot run dev"
echo "   pnpm --filter @gamevibe/web-runtime run dev"
echo "   pnpm --filter @gamevibe/multiplayer-server run dev"
echo ""
echo "   # Option 2: Use Docker"
echo "   docker-compose up"
echo ""
echo "For detailed instructions, see LOCAL_SETUP.md"
echo ""
echo "Happy gaming! 🎮✨"