export interface AIModel {
  provider: 'minimax';
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface GenerateOptions {
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
  tools?: LLMTool[];
}

export interface AnalyzeOptions {
  prompt: string;
  model: string;
  expectedFormat?: 'json' | 'text';
}

export interface AIResponse {
  content: string;
  model: string;
  tool_calls?: LLMToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}