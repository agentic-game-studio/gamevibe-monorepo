import 'reflect-metadata';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameVibeBot } from './bot.js';
import { BotConfig } from '@gamevibe/shared';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root directory
config({ path: join(__dirname, '../../../.env') });

// Build configuration
const botConfig: BotConfig = {
  discord: {
    token: process.env.DISCORD_TOKEN!,
    clientId: process.env.DISCORD_CLIENT_ID!,
    publicKey: process.env.DISCORD_PUBLIC_KEY
  },
  database: {
    url: process.env.DATABASE_URL!
  },
  redis: {
    url: process.env.REDIS_URL!
  },
  ai: {
    minimaxApiKey: process.env.MINIMAX_API_KEY!
  },
  webRuntime: process.env.WEB_RUNTIME_URL ? {
    url: process.env.WEB_RUNTIME_URL
  } : undefined,
  storage: {
    s3Bucket: process.env.S3_BUCKET || 'gamevibe-assets',
    s3Region: process.env.S3_REGION || 'us-east-1',
    s3AccessKey: process.env.S3_ACCESS_KEY || '',
    s3SecretKey: process.env.S3_SECRET_KEY || '',
    s3Endpoint: process.env.S3_ENDPOINT
  },
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    posthogApiKey: process.env.POSTHOG_API_KEY
  },
  botListing: {
    topgg: {
      token: process.env.TOPGG_TOKEN,
      webhookSecret: process.env.TOPGG_WEBHOOK_SECRET
    },
    discordBotsGG: {
      token: process.env.DISCORD_BOTS_GG_TOKEN,
      webhookSecret: process.env.DISCORD_BOTS_GG_WEBHOOK_SECRET
    },
    discordBotList: {
      token: process.env.DISCORD_BOT_LIST_TOKEN
    }
  },
  socialMedia: {
    twitter: {
      apiKey: process.env.TWITTER_API_KEY,
      apiSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
      bearerToken: process.env.TWITTER_BEARER_TOKEN
    },
    tiktok: {
      clientKey: process.env.TIKTOK_CLIENT_KEY,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET,
      redirectUri: process.env.TIKTOK_REDIRECT_URI
    },
    instagram: {
      accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
      clientId: process.env.INSTAGRAM_CLIENT_ID,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET
    },
    youtube: {
      apiKey: process.env.YOUTUBE_API_KEY,
      clientId: process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET
    }
  },
  features: {
    enableVoiceControls: process.env.ENABLE_VOICE_CONTROLS === 'true',
    enablePremiumFeatures: process.env.ENABLE_PREMIUM_FEATURES === 'true',
    maxFreeGamesPerMonth: parseInt(process.env.MAX_FREE_GAMES_PER_MONTH || '3')
  },
  environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info'
};

// Validate required configuration
const validateConfig = () => {
  const required = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'DATABASE_URL',
    'REDIS_URL',
    'MINIMAX_API_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    console.error('Please check your .env file');
    process.exit(1);
  }
};

// Main entry point
const main = async () => {
  try {
    console.log('Starting GameVibe Bot...');
    
    // Validate configuration
    validateConfig();
    
    // Create and start bot
    const bot = new GameVibeBot(botConfig);
    await bot.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
};

// Start the bot
main();