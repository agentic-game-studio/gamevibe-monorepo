# GameVibe AI Testing Guide

This guide covers all testing procedures for the GameVibe AI project.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Test Types](#test-types)
3. [Running Tests](#running-tests)
4. [Test Scripts](#test-scripts)
5. [CI/CD Testing](#cicd-testing)
6. [Troubleshooting](#troubleshooting)

## Quick Start

```bash
# Run all tests
./test-all.sh

# Test services only
./test-services.sh

# Test bot features
./test-bot-features.sh

# Performance tests
./test-performance.sh
```

## Test Types

### 1. Unit Tests
Tests individual components in isolation.

```bash
# Run all unit tests
pnpm test

# Run tests for specific package
pnpm --filter @gamevibe/bot run test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### 2. Integration Tests
Tests interaction between components.

```bash
# Run integration tests
pnpm run test:integration

# Test database operations
pnpm --filter @gamevibe/bot run test -- src/__tests__/integration/database.test.ts
```

### 3. End-to-End Tests
Tests complete user workflows.

```bash
# Run E2E tests
pnpm run test:e2e

# Run with UI
pnpm run test:e2e:ui

# Debug mode
pnpm run test:e2e:debug
```

### 4. API Tests
Tests REST API endpoints.

```bash
# Test health endpoints
curl http://localhost:8082/health/live

# Test with authentication
curl -H "X-API-Key: your-key" http://localhost:8082/api/v1/enterprise/games

# Test leaderboard submission
curl -X POST http://localhost:8082/api/leaderboard/game-123/submit \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","score":1000}'
```

## Running Tests

### Prerequisites

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Start Docker Services**
   ```bash
   docker-compose up -d postgres redis
   ```

3. **Setup Database**
   ```bash
   pnpm --filter @gamevibe/bot run db:push
   ```

4. **Start Bot (for API tests)**
   ```bash
   cd packages/bot && pnpm dev
   ```

### Test Commands by Package

#### @gamevibe/shared
```bash
pnpm --filter @gamevibe/shared run test
pnpm --filter @gamevibe/shared run lint
pnpm --filter @gamevibe/shared run typecheck
```

#### @gamevibe/bot
```bash
pnpm --filter @gamevibe/bot run test
pnpm --filter @gamevibe/bot run test:coverage
pnpm --filter @gamevibe/bot run lint
pnpm --filter @gamevibe/bot run typecheck
```

#### @gamevibe/ai-service
```bash
pnpm --filter @gamevibe/ai-service run test
pnpm --filter @gamevibe/ai-service run test -- --run
```

#### @gamevibe/game-engine
```bash
pnpm --filter @gamevibe/game-engine run test
pnpm --filter @gamevibe/game-engine run test:templates
```

## Test Scripts

### test-all.sh
Comprehensive test suite that runs:
- Environment checks
- Dependency installation
- Build verification
- Linting
- Type checking
- Unit tests
- Integration tests
- Docker builds

### test-services.sh
Service health checks:
- PostgreSQL connection
- Redis connection
- Database schema validation
- Bot HTTP endpoints
- Multiplayer server
- Web runtime

### test-bot-features.sh
Bot functionality tests:
- API endpoints
- Enterprise API
- Leaderboard system
- Database tables
- Redis caching

### test-performance.sh
Performance benchmarks:
- Endpoint response times
- Concurrent request handling
- Memory usage
- Stress testing

## CI/CD Testing

### GitHub Actions Workflow

```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm test
```

### Pre-commit Hooks

```bash
# Install husky
pnpm add -D husky
pnpm husky install

# Add pre-commit hook
pnpm husky add .husky/pre-commit "pnpm run lint && pnpm run typecheck"
```

## Testing Best Practices

### 1. Test Structure
```typescript
describe('FeatureName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = doSomething(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### 2. Mock External Services
```typescript
// Mock Discord client
const mockClient = {
  login: vi.fn(),
  on: vi.fn(),
  user: { id: 'bot-123' }
};

// Mock database
vi.mock('../utils/database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}));
```

### 3. Test Data Factories
```typescript
// Create test data
const createTestUser = (overrides = {}) => ({
  id: 'user-123',
  discordId: 'discord-123',
  username: 'testuser',
  createdAt: new Date(),
  ...overrides
});

const createTestGame = (overrides = {}) => ({
  id: 'game-123',
  title: 'Test Game',
  type: 'PLATFORMER',
  ...overrides
});
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find process using port
   lsof -i :8082
   
   # Kill process
   kill -9 <PID>
   ```

2. **Database Connection Failed**
   ```bash
   # Check PostgreSQL is running
   docker ps | grep postgres
   
   # Test connection
   PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres
   ```

3. **Redis Connection Failed**
   ```bash
   # Check Redis is running
   docker ps | grep redis
   
   # Test connection
   docker exec gamevibe-redis redis-cli ping
   ```

4. **TypeScript Errors**
   ```bash
   # Regenerate Prisma client
   pnpm --filter @gamevibe/bot run db:generate
   
   # Clear build cache
   pnpm clean && pnpm install
   ```

### Debug Mode

```bash
# Run tests with debug output
DEBUG=* pnpm test

# Run specific test file
pnpm test -- src/__tests__/services/game-generator.test.ts

# Run tests matching pattern
pnpm test -- --grep "should create game"
```

## Test Coverage

### Generate Coverage Report
```bash
# Run with coverage
pnpm test:coverage

# Open coverage report
open coverage/index.html
```

### Coverage Requirements
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

## Continuous Testing

### Watch Mode Development
```bash
# Terminal 1: Run services
docker-compose up postgres redis

# Terminal 2: Run bot
cd packages/bot && pnpm dev

# Terminal 3: Run tests in watch mode
pnpm test:watch
```

### Automated Testing
- Pre-commit: Linting and type checking
- Pre-push: Unit tests
- PR: Full test suite
- Main branch: E2E tests + deployment

## Performance Benchmarks

### Expected Performance
- Health endpoint: < 10ms
- API endpoints: < 50ms
- Database queries: < 100ms
- Game generation: < 5s
- Asset generation: < 10s

### Load Testing
```bash
# Install Apache Bench
brew install httpd  # macOS
apt-get install apache2-utils  # Linux

# Run load test
ab -n 1000 -c 10 http://localhost:8082/health/live
```

## Security Testing

### API Security
```bash
# Test authentication
curl -X POST http://localhost:8082/api/v1/enterprise/games \
  -H "X-API-Key: invalid-key" \
  -d '{"prompt":"test"}'
# Should return 401

# Test rate limiting
for i in {1..100}; do
  curl http://localhost:8082/health/live
done
```

### Input Validation
```bash
# Test SQL injection
curl -X POST http://localhost:8082/api/leaderboard/'; DROP TABLE users; --/submit

# Test XSS
curl -X POST http://localhost:8082/api/games \
  -d '{"title":"<script>alert(1)</script>"}'
```

## Monitoring Tests

### Health Checks
```bash
# Liveness (is process alive?)
curl http://localhost:8082/health/live

# Readiness (can accept traffic?)
curl http://localhost:8082/health/ready

# Full health status
curl http://localhost:8082/health
```

### Metrics
```bash
# Prometheus metrics
curl http://localhost:8082/metrics

# Parse specific metric
curl -s http://localhost:8082/metrics | grep gamevibe_games_generated_total
```