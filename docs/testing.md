# Testing Guide for GameVibe AI

This guide covers the comprehensive testing strategy for GameVibe AI, including unit tests, integration tests, and end-to-end tests.

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Running Tests](#running-tests)
3. [Writing Tests](#writing-tests)
4. [Test Structure](#test-structure)
5. [Testing Best Practices](#testing-best-practices)
6. [CI/CD Integration](#cicd-integration)

## Testing Overview

GameVibe AI uses a three-tier testing strategy:

- **Unit Tests**: Test individual functions and components in isolation
- **Integration Tests**: Test multiple components working together with real databases
- **End-to-End Tests**: Test the complete user journey through the application

### Testing Stack

- **Vitest**: Fast unit and integration testing framework
- **Playwright**: Cross-browser end-to-end testing
- **Mock Service Worker**: API mocking for frontend tests
- **Test Containers**: Spin up real databases for integration tests

## Running Tests

### Install Dependencies

```bash
pnpm install
```

### Unit Tests

```bash
# Run all unit tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Run tests for a specific package
pnpm --filter @gamevibe/bot test
```

### Integration Tests

Integration tests require PostgreSQL and Redis to be running:

```bash
# Start test databases with Docker
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
pnpm test:integration

# Stop test databases
docker-compose -f docker-compose.test.yml down
```

### End-to-End Tests

```bash
# Install Playwright browsers (first time only)
pnpm exec playwright install

# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Debug E2E tests
pnpm test:e2e:debug

# Run E2E tests in specific browser
pnpm test:e2e --project=chromium
```

### Run All Tests

```bash
# Run complete test suite
pnpm test:all
```

## Writing Tests

### Unit Test Example

```typescript
// packages/bot/src/__tests__/services/personal-credits.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PersonalCreditService } from '../../services/personal-credits.js';

describe('PersonalCreditService', () => {
  let service: PersonalCreditService;
  const mockPrisma = {
    personalCredits: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PersonalCreditService(mockPrisma as any);
  });

  describe('getUserCredits', () => {
    it('should return existing user credits', async () => {
      const mockCredits = {
        userId: '123',
        balance: 100,
        creatorTier: 'BRONZE',
      };
      mockPrisma.personalCredits.findUnique.mockResolvedValue(mockCredits);

      const result = await service.getUserCredits('123');

      expect(result).toEqual(mockCredits);
      expect(mockPrisma.personalCredits.findUnique).toHaveBeenCalledWith({
        where: { userId: '123' },
      });
    });
  });
});
```

### Integration Test Example

```typescript
// packages/bot/src/__tests__/integration/game-creation.integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { GameGeneratorService } from '../../services/game-generator.js';

describe('Game Creation Integration', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let gameGenerator: GameGeneratorService;

  beforeEach(async () => {
    prisma = new PrismaClient();
    redis = new Redis(process.env.REDIS_URL!);
    
    // Set up test data
    await prisma.subscription.create({
      data: {
        serverId: '123',
        tier: 'PRO',
        status: 'ACTIVE',
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.game.deleteMany();
    await prisma.subscription.deleteMany();
    await redis.flushdb();
    await prisma.$disconnect();
  });

  it('should create a game with credit deduction', async () => {
    const result = await gameGenerator.generateGame({
      prompt: 'Create a platformer',
      serverId: '123',
      userId: '456',
    });

    expect(result.success).toBe(true);
    expect(result.game).toBeDefined();
    expect(result.creditsUsed).toBeGreaterThan(0);
  });
});
```

### E2E Test Example

```typescript
// e2e/game-showcase.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Game Showcase', () => {
  test('should display game details', async ({ page }) => {
    await page.goto('/games');
    
    // Click on first game
    await page.locator('[data-testid="game-card"]').first().click();
    
    // Check game details are displayed
    await expect(page.locator('h1[data-testid="game-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="play-button"]')).toBeVisible();
  });
});
```

## Test Structure

### Directory Structure

```
gamevibe-ai/
├── packages/
│   ├── bot/
│   │   └── src/
│   │       └── __tests__/
│   │           ├── commands/      # Command tests
│   │           ├── services/      # Service tests
│   │           ├── api/          # API endpoint tests
│   │           ├── integration/  # Integration tests
│   │           └── utils/        # Test utilities
│   └── web-runtime/
│       └── src/
│           └── __tests__/        # Frontend tests
├── e2e/                          # End-to-end tests
├── vitest.config.ts              # Unit test config
├── vitest.config.integration.ts  # Integration test config
└── playwright.config.ts          # E2E test config
```

### Test Utilities

Use the provided test utilities for common operations:

```typescript
import { TestDatabase, TestRedis, MockDiscord, TestData } from '../utils/test-helpers';

// Set up test database
const db = new TestDatabase();
await db.setup();
await db.cleanup();

// Create mock Discord objects
const interaction = MockDiscord.createInteraction({
  commandName: 'share',
  user: { id: '123', username: 'testuser' },
});

// Generate test data
const game = TestData.createGame({
  title: 'Test Platformer',
  serverId: '123',
});
```

## Testing Best Practices

### 1. Test Naming

Use descriptive test names that explain what is being tested:

```typescript
// ❌ Bad
it('should work', () => {});

// ✅ Good
it('should deduct credits when creating a game with premium model', () => {});
```

### 2. Test Organization

Group related tests using `describe` blocks:

```typescript
describe('CreditService', () => {
  describe('deductCredits', () => {
    it('should deduct credits successfully', () => {});
    it('should fail if insufficient balance', () => {});
  });
  
  describe('allocateMonthlyCredits', () => {
    it('should allocate credits based on tier', () => {});
  });
});
```

### 3. Test Isolation

Each test should be independent and not rely on other tests:

```typescript
beforeEach(() => {
  // Reset state before each test
  vi.clearAllMocks();
  database.clear();
});

afterEach(() => {
  // Clean up after each test
  redis.flushdb();
});
```

### 4. Mock External Dependencies

Mock external services to keep tests fast and reliable:

```typescript
vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: 'session_123' }),
      },
    },
  })),
}));
```

### 5. Test Edge Cases

Don't just test the happy path:

```typescript
describe('addCredits', () => {
  it('should add credits successfully', () => {});
  it('should handle negative amounts', () => {});
  it('should enforce tier credit limits', () => {});
  it('should handle database errors', () => {});
  it('should handle concurrent requests', () => {});
});
```

### 6. Use Test Data Builders

Create reusable test data builders:

```typescript
class GameBuilder {
  private game = {
    id: crypto.randomUUID(),
    title: 'Test Game',
    type: 'PLATFORMER',
  };

  withTitle(title: string) {
    this.game.title = title;
    return this;
  }

  withType(type: string) {
    this.game.type = type;
    return this;
  }

  build() {
    return this.game;
  }
}

// Usage
const game = new GameBuilder()
  .withTitle('Epic Adventure')
  .withType('RPG')
  .build();
```

### 7. Test Coverage Goals

Aim for these coverage targets:
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 70%
- **Statements**: 80%

Critical paths (payments, auth) should have 95%+ coverage.

## CI/CD Integration

Tests run automatically in GitHub Actions:

1. **On Pull Requests**: All tests run before merge
2. **On Push to Main**: Tests run before deployment
3. **Scheduled**: Daily E2E tests against production

### GitHub Actions Test Jobs

```yaml
jobs:
  test:
    steps:
      - name: Run unit tests
        run: pnpm test
      
      - name: Run integration tests
        run: pnpm test:integration
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Local CI Testing

Test the CI pipeline locally using act:

```bash
# Install act
brew install act

# Run CI tests locally
act -j test
```

## Debugging Tests

### Debug Unit/Integration Tests

```bash
# Run specific test file
pnpm test src/__tests__/services/credit.test.ts

# Run tests matching pattern
pnpm test -t "should deduct credits"

# Run with verbose output
pnpm test --reporter=verbose
```

### Debug E2E Tests

```bash
# Run with headed browser
pnpm test:e2e --headed

# Run with slowmo
pnpm test:e2e --slow-mo=1000

# Generate trace on failure
pnpm test:e2e --trace on

# View trace
pnpm exec playwright show-trace trace.zip
```

### VS Code Debugging

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Test",
  "autoAttachChildProcesses": true,
  "skipFiles": ["<node_internals>/**", "**/node_modules/**"],
  "program": "${workspaceRoot}/node_modules/vitest/vitest.mjs",
  "args": ["run", "${file}"],
  "smartStep": true,
  "console": "integratedTerminal"
}
```

## Common Issues

### PostgreSQL Connection Errors

```bash
# Ensure test database is running
docker-compose -f docker-compose.test.yml ps

# Check connection string
echo $DATABASE_URL
```

### Redis Connection Errors

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
```

### Playwright Browser Issues

```bash
# Reinstall browsers
pnpm exec playwright install --force

# Check browser versions
pnpm exec playwright --version
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Discord.js Testing Guide](https://discordjs.guide/testing/)