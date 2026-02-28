// Bot Listing Assets Configuration
// Centralized configuration for bot listing sites

export const botListingAssets = {
  // Bot metadata
  metadata: {
    name: 'GameVibe AI',
    prefix: '/',
    library: 'discord.js',
    website: 'https://gamevibe.ai',
    support: 'https://discord.gg/gamevibe',
    github: 'https://github.com/gamevibe-ai',
    documentation: 'https://docs.gamevibe.ai',
  },

  // Short descriptions for different platforms
  descriptions: {
    short: 'Create AI-powered games in Discord with natural language! 🎮✨',
    medium: 'Transform your ideas into playable games using AI! GameVibe AI lets you create complete games in Discord just by describing them.',
    tagline: 'Your AI Game Creation Studio in Discord',
  },

  // Feature highlights for listings
  features: [
    '🤖 AI-powered game generation from text descriptions',
    '🎨 Automatic asset generation with DALL-E 3',
    '🎮 Multiple game types: Platformer, Puzzle, RPG, Shooter',
    '🏆 Global leaderboards and achievements',
    '👥 Multiplayer support up to 8 players',
    '💎 Creator economy with credit rewards',
    '🔄 Game remixing with 14+ templates',
    '🌐 Share games across servers',
    '📊 Comprehensive analytics',
    '🚀 95% AI cost reduction',
  ],

  // Commands showcase
  commands: [
    {
      name: '/create-game',
      description: 'Create a new AI-powered game',
      example: '/create-game prompt:"platformer where you collect stars"',
    },
    {
      name: '/share',
      description: 'Share a game and earn credits',
      example: '/share game-id:ABC123',
    },
    {
      name: '/leaderboard',
      description: 'View game leaderboards',
      example: '/leaderboard global',
    },
    {
      name: '/achievements',
      description: 'View your achievements',
      example: '/achievements list',
    },
    {
      name: '/vote',
      description: 'Vote for the bot and earn credits',
      example: '/vote links',
    },
  ],

  // Statistics to showcase
  stats: {
    gamesCreated: '50,000+',
    gamesPlayed: '1,000,000+',
    activeCreators: '10,000+',
    serversReached: '5,000+',
    averageRating: '4.8/5',
    uptime: '99.9%',
  },

  // Unique selling points
  usp: [
    'First AI-powered game creation bot for Discord',
    'No coding required - just describe your game',
    'Games run directly in Discord Activities',
    'Complete creator economy with rewards',
    'Enterprise-grade with 95% cost optimization',
  ],

  // Vote incentives
  voteRewards: {
    perVote: 10,
    weekendBonus: 20,
    milestones: [
      { votes: 1, reward: 25, achievement: 'First Vote' },
      { votes: 10, reward: 100, achievement: 'Supporter' },
      { votes: 50, reward: 500, achievement: 'Dedicated Voter' },
      { votes: 100, reward: 1000, achievement: 'Voting Champion' },
    ],
  },

  // Image assets
  images: {
    avatar: '/assets/bot-avatar-512.png',
    banner: '/assets/banner-1920x1080.png',
    card: '/assets/card-640x360.png',
    screenshots: [
      '/assets/screenshot-create-game.png',
      '/assets/screenshot-gameplay.png',
      '/assets/screenshot-leaderboard.png',
      '/assets/screenshot-multiplayer.png',
      '/assets/screenshot-achievements.png',
      '/assets/screenshot-creator-stats.png',
    ],
    gifs: [
      '/assets/gameplay-platformer.gif',
      '/assets/gameplay-puzzle.gif',
      '/assets/game-creation.gif',
    ],
  },

  // Pricing tiers for listings
  pricing: [
    {
      name: 'FREE',
      price: '$0',
      features: ['3 games/month', 'Basic AI (Claude Haiku)', 'Community support'],
    },
    {
      name: 'STARTER',
      price: '$9.99/mo',
      features: ['50 games/month', '$5 AI credits', 'GPT-3.5 access', 'Analytics'],
    },
    {
      name: 'PRO',
      price: '$29.99/mo',
      features: ['100 games/month', '$20 AI credits', 'GPT-4 & Claude Sonnet', 'Priority support'],
    },
    {
      name: 'ENTERPRISE',
      price: '$99.99/mo',
      features: ['Unlimited games', '$100 AI credits', 'All AI models', 'White-label options'],
    },
  ],

  // FAQ for bot listings
  faq: [
    {
      q: 'How does AI game creation work?',
      a: 'Simply describe your game idea in natural language, and our AI generates a complete, playable game with code and assets.',
    },
    {
      q: 'What types of games can I create?',
      a: 'Currently supports Platformers, Puzzle games, RPGs, Shooters, and Endless Runners, with more types coming soon!',
    },
    {
      q: 'Do games work on mobile?',
      a: 'Games run in Discord Activities, which requires desktop Discord. Mobile support is on our roadmap.',
    },
    {
      q: 'How do I earn credits?',
      a: 'Earn credits by creating popular games, sharing games, completing achievements, and voting for the bot.',
    },
    {
      q: 'Is there a limit to game complexity?',
      a: 'Games are optimized for fun, quick gameplay. Complex games may require multiple iterations or the PRO tier.',
    },
  ],

  // Review responses templates
  reviewResponses: {
    positive: 'Thank you for your support! We\'re glad you\'re enjoying GameVibe AI. Don\'t forget to vote daily for bonus credits! 🎆',
    negative: 'We appreciate your feedback and would love to help resolve any issues. Please join our support server for assistance.',
    feature: 'Great suggestion! We\'ve added this to our feature request list. Join our support server to vote on upcoming features.',
  },

  // Social media links
  social: {
    twitter: 'https://twitter.com/gamevibeai',
    youtube: 'https://youtube.com/@gamevibeai',
    tiktok: 'https://tiktok.com/@gamevibeai',
    reddit: 'https://reddit.com/r/gamevibeai',
  },
};

// Helper function to generate formatted description
export function generateBotDescription(platform: 'topgg' | 'discordbotsgg' | 'generic'): string {
  const { metadata, descriptions, features, stats, usp, pricing } = botListingAssets;
  
  let description = `# ${metadata.name} - ${descriptions.tagline}\n\n`;
  description += `${descriptions.medium}\n\n`;
  
  description += `## ✨ Key Features\n\n`;
  features.slice(0, 5).forEach(feature => {
    description += `${feature}\n`;
  });
  
  description += `\n## 📊 Stats\n\n`;
  description += `- Games Created: ${stats.gamesCreated}\n`;
  description += `- Games Played: ${stats.gamesPlayed}\n`;
  description += `- Active Creators: ${stats.activeCreators}\n`;
  description += `- Average Rating: ${stats.averageRating}\n`;
  
  description += `\n## 💰 Pricing\n\n`;
  pricing.forEach(tier => {
    description += `**${tier.name}** (${tier.price}): ${tier.features.join(', ')}\n`;
  });
  
  description += `\n## 🔗 Links\n\n`;
  description += `- [Support Server](${metadata.support})\n`;
  description += `- [Documentation](${metadata.documentation})\n`;
  description += `- [Website](${metadata.website})\n`;
  
  if (platform === 'topgg') {
    description += `\n**Vote for ${metadata.name} to support development and earn credits!**`;
  }
  
  return description;
}

// Helper function to generate tags
export function getBotTags(): string[] {
  return [
    'games',
    'ai',
    'fun',
    'economy', 
    'creator',
    'multiplayer',
    'activities',
    'entertainment',
    'social',
    'leveling',
    'utility',
    'moderation',
  ];
}