#!/bin/bash

# GameVibe AI Multiplayer Testing Script

echo "🎮 GameVibe AI Multiplayer Testing"
echo "=================================="

# Check if services are running
check_service() {
    local service=$1
    local port=$2
    echo -n "Checking $service on port $port... "
    if nc -z localhost $port 2>/dev/null; then
        echo "✅ OK"
    else
        echo "❌ Not running"
        return 1
    fi
}

echo ""
echo "1. Checking required services:"
echo "------------------------------"
check_service "PostgreSQL" 5433
check_service "Redis" 6380
check_service "Discord Bot API" 8081
check_service "Multiplayer Server" 2567

echo ""
echo "2. Testing multiplayer server health:"
echo "------------------------------------"
curl -s http://localhost:2567/health | jq '.' || echo "❌ Health check failed"

echo ""
echo "3. Creating test game via API:"
echo "------------------------------"
# This would require a valid Discord token
echo "⚠️  Skipping - requires Discord authentication"

echo ""
echo "4. WebSocket connection test:"
echo "----------------------------"
echo "Testing WebSocket connection to ws://localhost:2567..."

# Simple WebSocket test using wscat if available
if command -v wscat &> /dev/null; then
    echo "Testing with wscat..."
    timeout 5 wscat -c ws://localhost:2567 2>&1 | head -n 5
else
    echo "⚠️  wscat not installed. Install with: npm install -g wscat"
fi

echo ""
echo "5. Docker container status:"
echo "--------------------------"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep gamevibe

echo ""
echo "6. Recent logs from multiplayer server:"
echo "--------------------------------------"
docker logs gamevibe-multiplayer --tail 20 2>&1 || echo "⚠️  Container not running"

echo ""
echo "Testing complete!"
echo ""
echo "To test multiplayer functionality:"
echo "1. Ensure all services are running: docker-compose up"
echo "2. Use Discord to create a multiplayer game: /create-multiplayer-game"
echo "3. Share the room code with another player"
echo "4. Join using: /join-game <room-code>"
echo "5. Monitor logs: docker-compose logs -f gamevibe-multiplayer"