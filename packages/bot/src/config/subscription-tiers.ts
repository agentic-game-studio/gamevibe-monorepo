// GameVibe AI Subscription Tiers Configuration
// Server-based subscription model with credit-based AI access

export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    stripe_price_id: null, // No Stripe price ID for free tier
    features: {
      games_per_month: 3,
      concurrent_games: 1,
      max_players: 4,
      custom_assets: false,
      analytics: false,
      priority_support: false,
      api_access: false,
      white_label: false,
      priority_processing: false, // No priority processing for free tier
      ai_models: ['claude-3-5-haiku-latest'], // Basic model only
      monthly_ai_credits: 0, // No credits for premium models
      credit_rollover: false
    },
    limits: {
      rate_limit: '1 game per 5 minutes',
      asset_generation: 0,
      game_storage_days: 7,
      max_complexity: 'simple' // Only simple games
    }
  },
  
  starter: {
    name: 'Starter',
    price: 999, // $9.99 in cents
    stripe_price_id: process.env.STRIPE_STARTER_PRICE_ID,
    features: {
      games_per_month: 50,
      concurrent_games: 3,
      max_players: 10,
      custom_assets: false,
      analytics: true,
      priority_support: false,
      api_access: false,
      white_label: false,
      priority_processing: false, // No priority processing for starter tier
      ai_models: ['claude-3-5-haiku-latest', 'gpt-3.5-turbo'], // Basic + mid-tier
      monthly_ai_credits: 500, // $5 worth of premium model credits
      credit_rollover: true // Up to 2 months
    },
    limits: {
      rate_limit: '1 game per minute',
      asset_generation: 10,
      game_storage_days: 30,
      max_complexity: 'medium' // Simple + medium games
    }
  },
  
  pro: {
    name: 'Pro',
    price: 2999, // $29.99 (adjusted for sustainability)
    stripe_price_id: process.env.STRIPE_PRO_PRICE_ID,
    features: {
      games_per_month: 100, // capped to prevent loss
      concurrent_games: 10,
      max_players: -1, // unlimited
      custom_assets: true,
      analytics: true,
      priority_support: true,
      api_access: true,
      white_label: false,
      priority_processing: false, // No priority processing for pro tier
      ai_models: ['claude-3-5-haiku-latest', 'gpt-3.5-turbo', 'claude-3-5-sonnet-20241022'], // All except Opus
      monthly_ai_credits: 2000, // $20 worth of premium model credits
      credit_rollover: true // Up to 3 months
    },
    limits: {
      rate_limit: '10 games per minute',
      asset_generation: 50, // capped for sustainability
      game_storage_days: -1, // forever
      max_complexity: 'complex' // All complexity levels
    }
  },
  
  enterprise: {
    name: 'Enterprise',
    price: 9999, // $99.99 (premium enterprise pricing)
    stripe_price_id: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    features: {
      games_per_month: -1,
      concurrent_games: -1,
      max_players: -1,
      custom_assets: true,
      analytics: true,
      priority_support: true,
      api_access: true,
      white_label: true,
      custom_branding: true,
      dedicated_support: true,
      sla: true,
      priority_processing: true, // Faster game generation
      multi_server_support: true, // Use across multiple Discord servers
      custom_integrations: true, // Custom webhook/API integrations
      advanced_analytics: true, // Detailed usage reports and insights
      premium_support_sla: true, // 1-hour response time guarantee
      custom_domains: true, // Custom domain for web runtime
      advanced_api_access: true, // Full API access with higher rate limits
      bulk_operations: true, // Bulk game creation and management
      ai_models: ['claude-3-5-haiku-latest', 'gpt-3.5-turbo', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'], // All models
      monthly_ai_credits: 10000, // $100 worth of premium model credits
      credit_rollover: true // Up to 6 months
    },
    limits: {
      rate_limit: 'No limit',
      asset_generation: -1,
      game_storage_days: -1,
      api_calls_per_hour: -1, // Unlimited API calls
      priority_queue: true, // Skip generation queues
      max_complexity: 'enterprise' // Unlimited complexity
    }
  }
} as const;

// AI Credit System Pricing (in cents)
export const AI_CREDIT_PRICING = {
  // Model costs per 1000 tokens (in cents)
  'claude-3-5-haiku-latest': 25, // $0.25 - Always free for all tiers
  'gpt-3.5-turbo': 150, // $1.50 - Uses credits for STARTER+
  'claude-3-5-sonnet-20241022': 300, // $3.00 - Uses credits for PRO+
  'gpt-4-turbo': 1000, // $10.00 - Uses credits for PRO+
  'claude-3-opus-20240229': 1500, // $15.00 - Uses credits for ENTERPRISE or buy additional
  
  // Credit purchase options (additional credits beyond monthly allowance)
  credit_packs: {
    small: { credits: 500, price: 599 }, // $5.99 for $5 worth of credits (20% markup)
    medium: { credits: 1000, price: 1099 }, // $10.99 for $10 worth (10% markup)
    large: { credits: 2500, price: 2499 }, // $24.99 for $25 worth (0% markup - best value)
    xl: { credits: 5000, price: 4799 } // $47.99 for $50 worth (4% discount)
  }
} as const;

// Usage-based pricing for overages
export const OVERAGE_PRICING = {
  additional_game: 39, // $0.39 per game over limit
  additional_asset_pack: 199, // $1.99 per 10 assets
  api_call: 1, // $0.01 per 1000 API calls
  multiplayer_hour: 49 // $0.49 per hour of multiplayer server time
} as const;

// Tier comparison for UI display
export const TIER_COMPARISONS = {
  free: {
    emoji: '🆓',
    color: '#9ca3af',
    level: 0
  },
  starter: {
    emoji: '🚀',
    color: '#3b82f6',
    level: 1
  },
  pro: {
    emoji: '⭐',
    color: '#f59e0b',
    level: 2
  },
  enterprise: {
    emoji: '👑',
    color: '#8b5cf6',
    level: 3
  }
} as const;

// Type definitions
export type SubscriptionTierKey = keyof typeof SUBSCRIPTION_TIERS;
export type TierFeatures = typeof SUBSCRIPTION_TIERS[SubscriptionTierKey]['features'];
export type TierLimits = typeof SUBSCRIPTION_TIERS[SubscriptionTierKey]['limits'];

// Helper functions
export function getTierFeatures(tier: string): TierFeatures {
  return SUBSCRIPTION_TIERS[tier as SubscriptionTierKey]?.features || SUBSCRIPTION_TIERS.free.features;
}

export function getTierLimits(tier: string): TierLimits {
  return SUBSCRIPTION_TIERS[tier as SubscriptionTierKey]?.limits || SUBSCRIPTION_TIERS.free.limits;
}

export function canUseFeature(tier: string, feature: keyof TierFeatures): boolean {
  const features = getTierFeatures(tier);
  return features[feature] === true || features[feature] === -1;
}

export function isWithinLimit(tier: string, limit: keyof TierLimits, current: number): boolean {
  const limits = getTierLimits(tier);
  const maxLimit = limits[limit];
  return maxLimit === -1 || current < maxLimit;
}

export function getTierLevel(tier: string): number {
  return TIER_COMPARISONS[tier as SubscriptionTierKey]?.level || 0;
}

export function getTierEmoji(tier: string): string {
  return TIER_COMPARISONS[tier as SubscriptionTierKey]?.emoji || '🆓';
}

export function getTierColor(tier: string): string {
  return TIER_COMPARISONS[tier as SubscriptionTierKey]?.color || '#9ca3af';
}

export function getRequiredTier(feature: keyof TierFeatures): SubscriptionTierKey {
  for (const [tierName, tierConfig] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (tierConfig.features[feature] === true || tierConfig.features[feature] === -1) {
      return tierName as SubscriptionTierKey;
    }
  }
  return 'free';
}

export function getTierDescription(tier: string): string {
  const config = SUBSCRIPTION_TIERS[tier as SubscriptionTierKey];
  if (!config) return 'Unknown tier';
  
  const features = [];
  if (config.features.games_per_month === -1) {
    features.push('Unlimited games');
  } else {
    features.push(`${config.features.games_per_month} games/month`);
  }
  
  if (config.features.custom_assets) {
    features.push('AI-generated assets');
  }
  
  if (config.features.analytics) {
    features.push('Analytics dashboard');
  }
  
  if (config.features.priority_support) {
    features.push('Priority support');
  }
  
  if (config.features.api_access) {
    features.push('API access');
  }

  // Enterprise-specific features
  if (config.features.white_label) {
    features.push('White-label branding');
  }
  
  if (config.features.priority_processing) {
    features.push('Priority processing');
  }
  
  if (config.features.multi_server_support) {
    features.push('Multi-server support');
  }
  
  if (config.features.premium_support_sla) {
    features.push('1-hour SLA support');
  }
  
  return features.join(' • ');
}

// Rate limiting helpers
export function getRateLimit(tier: string, action: string): number {
  switch (tier) {
    case 'free':
      return action === 'create_game' ? 1 : 0; // 1 per 5 minutes handled elsewhere
    case 'starter':
      return action === 'create_game' ? 1 : 2; // 1 per minute
    case 'pro':
      return action === 'create_game' ? 10 : 20; // 10 per minute
    case 'enterprise':
      return -1; // no limit
    default:
      return 0;
  }
}