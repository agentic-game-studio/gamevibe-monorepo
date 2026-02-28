#!/bin/bash

# GameVibe AI - Local Development Starter
# This script starts all services for local development

echo "🎮 Starting GameVibe AI Services..."
echo "=================================="
echo ""

# Function to kill all child processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    pkill -P $$ 2>/dev/null
    exit
}

trap cleanup INT TERM

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please run ./setup-local.sh first or copy .env.example to .env"
    exit 1
fi

# Start services
echo "🤖 Starting Discord Bot..."
pnpm --filter @gamevibe/bot run dev &
BOT_PID=$!

echo "🌐 Starting Web Runtime..."
pnpm --filter @gamevibe/web-runtime run dev &
WEB_PID=$!

echo "🎮 Starting Multiplayer Server..."
pnpm --filter @gamevibe/multiplayer-server run dev &
MP_PID=$!

echo ""
echo "✅ All services started!"
echo ""
echo "📍 Service URLs:"
echo "   - Bot: Running in Discord"
echo "   - Web Runtime: http://localhost:3001"
echo "   - Multiplayer: ws://localhost:2567"
echo "   - Database Studio: Run 'pnpm --filter @gamevibe/bot run db:studio'"
echo ""
echo "📝 Available commands in Discord:"
echo "   /create-game - Create a single-player game"
echo "   /create-multiplayer-game - Create a multiplayer game"
echo "   /help - Show all commands"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait