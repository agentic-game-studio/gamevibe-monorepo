export interface BotConfig {
  discord: {
    token: string;
    clientId: string;
    publicKey?: string;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  ai: {
    minimaxApiKey: string;
  };
  webRuntime?: {
    url: string;
  };
  storage?: {
    s3Bucket: string;
    s3Region: string;
    s3AccessKey: string;
    s3SecretKey: string;
    s3Endpoint?: string;
  };
  monitoring?: {
    sentryDsn?: string;
    posthogApiKey?: string;
  };
  botListing?: {
    topgg?: {
      token?: string;
      webhookSecret?: string;
    };
    discordBotsGG?: {
      token?: string;
      webhookSecret?: string;
    };
    discordBotList?: {
      token?: string;
    };
  };
  socialMedia?: {
    twitter?: {
      apiKey?: string;
      apiSecret?: string;
      accessToken?: string;
      accessSecret?: string;
      bearerToken?: string;
    };
    tiktok?: {
      clientKey?: string;
      clientSecret?: string;
      redirectUri?: string;
    };
    instagram?: {
      accessToken?: string;
      clientId?: string;
      clientSecret?: string;
    };
    youtube?: {
      apiKey?: string;
      clientId?: string;
      clientSecret?: string;
    };
  };
  features?: {
    enableVoiceControls: boolean;
    enablePremiumFeatures: boolean;
    maxFreeGamesPerMonth: number;
  };
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}