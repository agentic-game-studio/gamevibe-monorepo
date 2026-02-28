# GameVibe AI Showcase Portal

The public-facing web portal for discovering and playing GameVibe AI games.

## Overview

The Showcase Portal is a Next.js 14 application that provides:
- Browse and search AI-generated games
- View creator profiles and leaderboards
- Play games directly in the browser
- Share games on social media
- Embed games on external websites

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Animations**: Framer Motion
- **Icons**: React Icons
- **Analytics**: Vercel Analytics

## Features

### 🎮 Game Discovery
- Trending games algorithm
- Search and filter by type
- Featured games curation
- Similar games recommendations

### 👤 Creator Profiles
- Creator tiers (Bronze → Diamond)
- Earnings and statistics
- Game portfolios
- Achievement showcases

### 🏆 Leaderboards
- Global player rankings
- Per-game leaderboards
- Creator leaderboards
- Server rankings

### 🔗 Social Features
- Game sharing with preview cards
- Embeddable game widgets
- Social media integration
- SEO-optimized landing pages

### 📊 Analytics
- Real-time play tracking
- Viral coefficient monitoring
- Engagement metrics
- Creator analytics

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm --filter @gamevibe/showcase-portal run dev

# Build for production
pnpm --filter @gamevibe/showcase-portal run build

# Run production server
pnpm --filter @gamevibe/showcase-portal run start

# Run tests
pnpm --filter @gamevibe/showcase-portal run test
```

## Environment Variables

Create a `.env.local` file:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WEB_RUNTIME_URL=http://localhost:3001

# Discord OAuth (for embedded games)
NEXT_PUBLIC_DISCORD_CLIENT_ID=your_client_id

# Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id

# CDN Configuration
NEXT_PUBLIC_CDN_URL=https://cdn.gamevibe.ai
```

## Project Structure

```
showcase-portal/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── games/        # Game browsing pages
│   │   ├── creators/     # Creator profiles
│   │   ├── leaderboard/  # Leaderboard pages
│   │   └── api/          # API routes (if needed)
│   ├── components/       # React components
│   │   ├── games/        # Game-related components
│   │   ├── creators/     # Creator components
│   │   ├── home/         # Homepage sections
│   │   └── layout/       # Layout components
│   ├── lib/             # Utilities and API client
│   ├── hooks/           # Custom React hooks
│   └── styles/          # Global styles
├── public/              # Static assets
└── tests/               # Test files
```

## API Integration

The portal integrates with the GameVibe backend API:

### Endpoints Used
- `/api/discover/trending` - Trending games
- `/api/discover/search` - Game search
- `/api/discover/featured` - Featured games
- `/api/creators/top` - Top creators
- `/api/leaderboard/*` - Leaderboard data
- `/api/live-activity/feed` - Live activity feed
- `/api/embed/generate` - Generate embed codes

### Data Models
- `Game` - Game information with metadata
- `Creator` - Creator profile with tier info
- `LeaderboardEntry` - Score entries
- `TrendingGame` - Games with viral metrics

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production deployment
vercel --prod
```

### Docker
```bash
# Build image
docker build -f Dockerfile.portal -t gamevibe-portal .

# Run container
docker run -p 3002:3002 gamevibe-portal
```

### Environment-Specific Builds
```bash
# Development
pnpm run build:dev

# Staging
pnpm run build:staging

# Production
pnpm run build:prod
```

## Performance Optimization

- **Static Generation**: Game pages are statically generated
- **ISR**: Incremental Static Regeneration for dynamic content
- **Image Optimization**: Next.js Image component with CDN
- **Code Splitting**: Automatic route-based splitting
- **Caching**: React Query with intelligent cache management

## SEO Optimization

- **Meta Tags**: Dynamic OpenGraph and Twitter cards
- **Sitemap**: Auto-generated sitemap.xml
- **Robots.txt**: Proper search engine directives
- **Structured Data**: JSON-LD for rich results
- **Performance**: Core Web Vitals optimization

## Security

- **CSP Headers**: Content Security Policy
- **CORS**: Proper cross-origin configuration
- **Rate Limiting**: API request throttling
- **Input Validation**: Zod schemas for all inputs
- **XSS Protection**: React's built-in protections

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage report
pnpm test:coverage
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Ensure all tests pass
5. Submit a pull request

## License

MIT