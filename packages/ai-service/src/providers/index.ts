export interface AIProvider {
  name: string;
  models: string[];
  generate(prompt: string, options: any): Promise<string>;
  stream(prompt: string, options: any): AsyncGenerator<string>;
}

export const AI_MODELS = {
  // Claude models
  CLAUDE_3_HAIKU: 'claude-3-5-haiku-latest',
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',
  
  // OpenAI models
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
  GPT_4: 'gpt-4',
  GPT_4_TURBO: 'gpt-4-turbo-preview'
} as const;

export const DEFAULT_MODELS = {
  fast: AI_MODELS.CLAUDE_3_HAIKU,
  balanced: AI_MODELS.CLAUDE_3_SONNET,
  powerful: AI_MODELS.GPT_4_TURBO
} as const;