#!/bin/bash

echo "🧪 GameVibe AI Complete Test Suite"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local name=$1
    local command=$2
    
    echo -e "\n${YELLOW}Running: $name${NC}"
    echo "Command: $command"
    
    if eval "$command"; then
        echo -e "${GREEN}✅ PASSED: $name${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAILED: $name${NC}"
        ((TESTS_FAILED++))
    fi
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

# 1. Environment Setup Tests
echo -e "\n${YELLOW}=== 1. ENVIRONMENT SETUP ===${NC}"

run_test "PostgreSQL Container" "docker ps | grep -q gamevibe-postgres"
run_test "Redis Container" "docker ps | grep -q gamevibe-redis"
run_test "Database Connection" "PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d postgres -c 'SELECT 1' > /dev/null 2>&1"
run_test "Environment File" "test -f .env"

# 2. Dependencies Tests
echo -e "\n${YELLOW}=== 2. DEPENDENCIES ===${NC}"

run_test "Install Dependencies" "pnpm install --frozen-lockfile"
run_test "Check Workspaces" "pnpm -r list --depth 0 | grep -q '@gamevibe'"

# 3. Build Tests
echo -e "\n${YELLOW}=== 3. BUILD TESTS ===${NC}"

run_test "Build Shared Package" "pnpm --filter @gamevibe/shared run build"
run_test "Build AI Service" "pnpm --filter @gamevibe/ai-service run build"
run_test "Build Game Engine" "pnpm --filter @gamevibe/game-engine run build"
run_test "Build Bot" "pnpm --filter @gamevibe/bot run build"
run_test "Build All Packages" "pnpm run build"

# 4. Linting Tests
echo -e "\n${YELLOW}=== 4. LINTING ===${NC}"

run_test "Lint Shared Package" "pnpm --filter @gamevibe/shared run lint"
run_test "Lint Bot Package" "pnpm --filter @gamevibe/bot run lint"
run_test "Lint All Packages" "pnpm run lint"

# 5. Type Checking Tests
echo -e "\n${YELLOW}=== 5. TYPE CHECKING ===${NC}"

run_test "TypeCheck Shared" "pnpm --filter @gamevibe/shared run typecheck"
run_test "TypeCheck Bot" "pnpm --filter @gamevibe/bot run typecheck"
run_test "TypeCheck All" "pnpm run typecheck"

# 6. Unit Tests
echo -e "\n${YELLOW}=== 6. UNIT TESTS ===${NC}"

run_test "Unit Tests - Shared" "pnpm --filter @gamevibe/shared run test"
run_test "Unit Tests - AI Service" "pnpm --filter @gamevibe/ai-service run test"
run_test "Unit Tests - Bot" "pnpm --filter @gamevibe/bot run test"
run_test "Unit Tests - All" "pnpm test"

# 7. Integration Tests
echo -e "\n${YELLOW}=== 7. INTEGRATION TESTS ===${NC}"

run_test "Integration Tests" "pnpm run test:integration"

# 8. Database Tests
echo -e "\n${YELLOW}=== 8. DATABASE TESTS ===${NC}"

run_test "Prisma Generate" "pnpm --filter @gamevibe/bot run db:generate"
run_test "Database Push" "pnpm --filter @gamevibe/bot run db:push"

# 9. Bot Runtime Tests
echo -e "\n${YELLOW}=== 9. BOT RUNTIME TESTS ===${NC}"

# Start bot in background
echo "Starting bot for runtime tests..."
cd packages/bot && pnpm dev > test-bot.log 2>&1 &
BOT_PID=$!
cd ../..
sleep 15

run_test "Bot HTTP Server" "nc -z localhost 8082"
run_test "Health Endpoint" "curl -f -s http://localhost:8082/health/live > /dev/null"
run_test "Bot Status" "curl -f -s http://localhost:8082/status > /dev/null"
run_test "Metrics Endpoint" "curl -f -s http://localhost:8082/metrics > /dev/null"

# Stop bot
kill $BOT_PID 2>/dev/null
rm -f packages/bot/test-bot.log

# 10. Docker Tests
echo -e "\n${YELLOW}=== 10. DOCKER TESTS ===${NC}"

run_test "Build Bot Docker Image" "docker build -f Dockerfile.bot -t gamevibe-bot-test ."
run_test "Build Web Docker Image" "docker build -f Dockerfile.web -t gamevibe-web-test ."

# 11. E2E Tests (if playwright is set up)
echo -e "\n${YELLOW}=== 11. E2E TESTS ===${NC}"

if [ -f "playwright.config.ts" ]; then
    run_test "E2E Tests" "pnpm run test:e2e"
else
    echo "Skipping E2E tests (Playwright not configured)"
fi

# Test Summary
echo -e "\n${YELLOW}=== TEST SUMMARY ===${NC}"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed!${NC}"
    exit 1
fi