import { test, expect } from '@playwright/test';

test.describe('Game Showcase', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the homepage', async ({ page }) => {
    // Check main elements are present
    await expect(page.locator('h1')).toContainText(/GameVibe AI/i);
    await expect(page.locator('text=Create games with AI')).toBeVisible();
    
    // Check navigation
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('nav >> text=Games')).toBeVisible();
    await expect(page.locator('nav >> text=Creators')).toBeVisible();
    await expect(page.locator('nav >> text=About')).toBeVisible();
  });

  test('should navigate to games listing', async ({ page }) => {
    // Click on Games link
    await page.click('nav >> text=Games');
    
    // Wait for games page to load
    await page.waitForURL('**/games');
    
    // Check games grid is displayed
    await expect(page.locator('[data-testid="games-grid"]')).toBeVisible();
    
    // Check filters are available
    await expect(page.locator('text=Filter by Type')).toBeVisible();
    await expect(page.locator('text=Sort by')).toBeVisible();
  });

  test('should display game details', async ({ page }) => {
    // Navigate to games
    await page.goto('/games');
    
    // Click on first game card
    await page.locator('[data-testid="game-card"]').first().click();
    
    // Wait for game details page
    await page.waitForURL(/\/games\/[A-Z0-9]+/);
    
    // Check game details are displayed
    await expect(page.locator('h1[data-testid="game-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-description"]')).toBeVisible();
    await expect(page.locator('[data-testid="play-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-button"]')).toBeVisible();
    
    // Check game stats
    await expect(page.locator('text=/Plays: \\d+/')).toBeVisible();
    await expect(page.locator('text=/Shares: \\d+/')).toBeVisible();
    await expect(page.locator('text=/Created by:/')).toBeVisible();
  });

  test('should handle game search', async ({ page }) => {
    await page.goto('/games');
    
    // Type in search box
    const searchBox = page.locator('[data-testid="search-input"]');
    await searchBox.fill('platformer');
    await searchBox.press('Enter');
    
    // Wait for search results
    await page.waitForURL(/\?search=platformer/);
    
    // Check results are filtered
    const gameCards = page.locator('[data-testid="game-card"]');
    const count = await gameCards.count();
    
    if (count > 0) {
      // Verify at least one game contains search term
      const firstGameTitle = await gameCards.first().locator('h3').textContent();
      expect(firstGameTitle?.toLowerCase()).toContain('platformer');
    }
  });

  test('should display creator leaderboard', async ({ page }) => {
    // Navigate to creators page
    await page.click('nav >> text=Creators');
    await page.waitForURL('**/creators');
    
    // Check leaderboard is displayed
    await expect(page.locator('h1')).toContainText(/Top Creators/i);
    await expect(page.locator('[data-testid="creator-leaderboard"]')).toBeVisible();
    
    // Check creator cards
    const creatorCards = page.locator('[data-testid="creator-card"]');
    await expect(creatorCards.first()).toBeVisible();
    
    // Check creator stats are shown
    await expect(page.locator('text=/Games Created: \\d+/').first()).toBeVisible();
    await expect(page.locator('text=/Total Plays: \\d+/').first()).toBeVisible();
    await expect(page.locator('text=/Tier: (Bronze|Silver|Gold|Diamond)/').first()).toBeVisible();
  });

  test('should handle responsive design', async ({ page, viewport }) => {
    // Test mobile menu
    if (viewport?.width && viewport.width < 768) {
      // Check mobile menu button is visible
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      
      // Open mobile menu
      await page.click('[data-testid="mobile-menu-button"]');
      
      // Check menu items are visible
      await expect(page.locator('[data-testid="mobile-menu"] >> text=Games')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-menu"] >> text=Creators')).toBeVisible();
    } else {
      // Check desktop navigation is visible
      await expect(page.locator('nav >> text=Games')).toBeVisible();
    }
  });

  test('should display trending games', async ({ page }) => {
    // Check trending section on homepage
    await expect(page.locator('text=Trending Games')).toBeVisible();
    
    const trendingGames = page.locator('[data-testid="trending-games"] >> [data-testid="game-card"]');
    await expect(trendingGames.first()).toBeVisible();
    
    // Each trending game should show viral stats
    await expect(page.locator('[data-testid="trending-games"] >> text=/🔥 \\d+ servers/')).toBeVisible();
  });

  test('should handle game embedding', async ({ page }) => {
    // Navigate to a game
    await page.goto('/games');
    await page.locator('[data-testid="game-card"]').first().click();
    
    // Click embed button
    await page.click('[data-testid="embed-button"]');
    
    // Check embed modal appears
    await expect(page.locator('[data-testid="embed-modal"]')).toBeVisible();
    await expect(page.locator('text=Embed Code')).toBeVisible();
    
    // Check copy button works
    await page.click('[data-testid="copy-embed-code"]');
    await expect(page.locator('text=Copied!')).toBeVisible();
  });

  test('should display game SEO metadata', async ({ page }) => {
    // Navigate to a specific game
    await page.goto('/games');
    const firstGameUrl = await page.locator('[data-testid="game-card"]').first().getAttribute('href');
    
    if (firstGameUrl) {
      await page.goto(firstGameUrl);
      
      // Check meta tags
      const title = await page.title();
      expect(title).toContain('GameVibe AI');
      
      // Check OpenGraph tags
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      expect(ogTitle).toBeTruthy();
      
      const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
      expect(ogDescription).toBeTruthy();
      
      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
      expect(ogImage).toBeTruthy();
    }
  });

  test('should handle 404 pages gracefully', async ({ page }) => {
    // Navigate to non-existent game
    await page.goto('/games/NONEXISTENT');
    
    // Check 404 page is displayed
    await expect(page.locator('text=/Game not found|404/i')).toBeVisible();
    await expect(page.locator('text=Back to Games')).toBeVisible();
    
    // Can navigate back
    await page.click('text=Back to Games');
    await expect(page).toHaveURL('/games');
  });
});