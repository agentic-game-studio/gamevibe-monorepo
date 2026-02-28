# @gamevibe/asset-generator

AI-powered asset generation service for GameVibe AI. Generates game sprites, backgrounds, UI elements, and effects using DALL-E 3 and other AI models.

## Features

- 🎨 AI-powered asset generation using DALL-E 3
- 🗄️ S3-compatible storage with CDN support
- ⚡ Redis caching for performance
- 🖼️ Automatic image optimization and resizing
- 📦 Sprite sheet generation for animations
- 🏷️ Asset library management and browsing
- 🔧 Multiple format support (PNG, WebP)

## Installation

```bash
pnpm add @gamevibe/asset-generator
```

## Configuration

```typescript
import { AssetGeneratorService } from '@gamevibe/asset-generator';

const service = new AssetGeneratorService({
  openaiApiKey: process.env.OPENAI_API_KEY,
  storage: {
    bucket: 'gamevibe-assets',
    region: 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    cdnUrl: 'https://cdn.gamevibe.ai'
  },
  cache: {
    redis: {
      host: 'localhost',
      port: 6379
    },
    ttl: {
      hot: 3600,      // 1 hour
      template: 86400, // 24 hours
      metadata: 7200   // 2 hours
    }
  }
}, logger);
```

## Usage

### Generate Assets for a Game

```typescript
const requirements: VisualRequirements = {
  gameId: 'game123',
  gameType: 'platformer',
  style: 'pixel-art',
  colorScheme: 'vibrant',
  theme: 'fantasy',
  description: 'A magical platformer game',
  sprites: [
    {
      name: 'player',
      description: 'Brave knight character',
      size: 'medium',
      animated: true,
      frameCount: 4,
      tags: ['hero', 'player']
    }
  ],
  backgrounds: [
    {
      name: 'forest',
      description: 'Enchanted forest background',
      parallax: true,
      layers: 3
    }
  ]
};

const job = await service.generateGameAssets('game123', requirements);

// Check job status
const status = await service.getGenerationStatus(job.id);
```

### Browse and Search Assets

```typescript
const browser = service.getAssetBrowser();

const result = await browser.browse({
  gameId: 'game123',
  type: 'sprite',
  sortBy: 'date',
  page: 1
});

console.log(`Found ${result.assets.length} assets`);
```

### Create Asset Collections

```typescript
const libraryManager = service.getLibraryManager();

const collection = await libraryManager.createCollection(
  'Fantasy Characters',
  assets,
  {
    theme: 'fantasy',
    style: 'pixel-art',
    colorScheme: 'vibrant',
    tags: ['characters', 'heroes']
  }
);
```

## Asset Types

- **Sprites**: Player characters, enemies, collectibles
- **Backgrounds**: Game environments with parallax support
- **UI Elements**: Buttons, health bars, score displays
- **Effects**: Particles, explosions, trails
- **Tiles**: Repeating patterns for levels

## Image Processing

All generated assets are automatically:
- Optimized for web delivery
- Resized to appropriate game dimensions
- Converted to optimal formats (PNG for sprites, WebP for backgrounds)
- Generated in multiple resolutions (1x, 2x)
- Thumbnail versions created

## Integration with Game Generation

The asset generator integrates seamlessly with the game generation flow:

1. Game request is analyzed
2. Visual requirements are extracted
3. Assets are generated in parallel
4. Generated asset URLs are injected into game code
5. Games use real assets instead of placeholders

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Type check
pnpm typecheck
```

## API Reference

See the [API documentation](./docs/api.md) for detailed method signatures and options.