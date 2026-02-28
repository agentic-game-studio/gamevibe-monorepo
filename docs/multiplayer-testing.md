# Multiplayer Testing Guide

This guide explains how to test the multiplayer functionality in GameVibe AI locally.

## Prerequisites

1. Docker and Docker Compose installed
2. Discord bot configured with proper tokens
3. Node.js 20+ and pnpm installed

## Quick Start

### 1. Start All Services

```bash
# Start the full development environment
docker-compose up

# Or start only essential services for multiplayer
docker-compose up postgres redis gamevibe-bot gamevibe-multiplayer gamevibe-web
```

### 2. Verify Services

Run the test script to verify all services are running:

```bash
./scripts/test-multiplayer.sh
```

You should see:
- PostgreSQL on port 5433
- Redis on port 6380
- Discord Bot API on port 8081
- Multiplayer Server on port 2567

### 3. Create a Multiplayer Game

1. In Discord, use the command:
   ```
   /create-multiplayer-game prompt:"space shooter battle" max-players:4
   ```

2. Note the room code displayed (e.g., `ABC123`)

3. Click "Play Now" to launch the game

### 4. Join from Another Account

1. From a different Discord account, use:
   ```
   /join-game code:ABC123
   ```

2. Click "Join Game" to enter the multiplayer session

## Local Development Testing

### Testing Without Discord

For development testing without Discord integration:

1. Start the multiplayer server standalone:
   ```bash
   cd packages/multiplayer-server
   pnpm run dev
   ```

2. Use a WebSocket testing tool:
   ```bash
   # Install wscat
   npm install -g wscat

   # Connect to the server
   wscat -c ws://localhost:2567
   ```

3. Send test messages:
   ```json
   {"type": "joinOrCreate", "room": "test_room"}
   ```

### Browser Testing

1. Open multiple browser windows/tabs
2. Navigate to `http://localhost:3001/game/test-game-id?room=TEST01&token=dev-token`
3. Each window simulates a different player

## Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# Just multiplayer server
docker-compose logs -f gamevibe-multiplayer

# Bot logs
docker-compose logs -f gamevibe-bot
```

### Jaeger Tracing

Open http://localhost:16686 to view distributed traces.

### Health Checks

- Bot API: http://localhost:8081/health/ready
- Multiplayer: http://localhost:2567/health

## Common Issues

### Port Conflicts

If you get port binding errors:

1. Check for existing services:
   ```bash
   lsof -i :2567  # Multiplayer port
   lsof -i :5433  # PostgreSQL port
   ```

2. Stop conflicting services or change ports in docker-compose.yml

### Connection Refused

1. Ensure all services are healthy:
   ```bash
   docker-compose ps
   ```

2. Check network connectivity:
   ```bash
   docker network ls
   docker network inspect gamevibe-network
   ```

### Authentication Errors

1. Verify JWT_SECRET is set in both services:
   ```bash
   docker-compose exec gamevibe-bot env | grep JWT_SECRET
   docker-compose exec gamevibe-multiplayer env | grep JWT_SECRET
   ```

2. Ensure they match!

## Advanced Testing

### Load Testing

Use Artillery for load testing:

```bash
# Install Artillery
npm install -g artillery

# Create test script (artillery.yml)
config:
  target: "ws://localhost:2567"
  phases:
    - duration: 60
      arrivalRate: 10
  processor: "./multiplayer-test.js"

scenarios:
  - name: "Join and play"
    engine: "ws"
    flow:
      - send: '{"type": "join", "room": "load-test"}'
      - think: 5
      - send: '{"type": "move", "x": 100, "y": 200}'
      - think: 1
```

### Performance Monitoring

1. CPU/Memory usage:
   ```bash
   docker stats gamevibe-multiplayer
   ```

2. Redis monitoring:
   ```bash
   docker exec -it gamevibe-redis redis-cli monitor
   ```

## Debugging Tips

### Enable Debug Logs

Set LOG_LEVEL=debug in docker-compose.yml:

```yaml
environment:
  LOG_LEVEL: debug
```

### Inspect WebSocket Traffic

Use Chrome DevTools:
1. Open Network tab
2. Filter by WS
3. Click on WebSocket connection
4. View Messages tab

### Database Queries

Connect to PostgreSQL:
```bash
docker exec -it gamevibe-postgres psql -U postgres -d gamevibe

# View active game sessions
SELECT * FROM "Game" WHERE metadata->>'multiplayer' IS NOT NULL;
```

## Next Steps

- Implement more multiplayer game templates
- Add spectator mode
- Create automated multiplayer tests
- Add room persistence across server restarts