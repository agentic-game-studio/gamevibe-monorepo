export interface AIModel {
  provider: 'minimax';
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateOptions {
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export interface AnalyzeOptions {
  prompt: string;
  model: string;
  expectedFormat?: 'json' | 'text';
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}