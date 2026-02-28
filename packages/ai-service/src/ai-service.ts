import PQueue from 'p-queue';
import {
  GenerateOptions,
  AnalyzeOptions,
  AIResponse,
  hashStringSync,
  generateCacheKey
} from '@gamevibe/shared';
import { GamePromptBuilder } from './prompts/index.js';

export interface AIServiceConfig {
  minimaxApiKey: string;
  redis?: {
    get: <T>(key: string) => Promise<T | null>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
  };
}

/** MiniMax API constants */
const MINIMAX_BASE_URL = 'https://api.minimax.io/anthropic';
const DEFAULT_MODEL = 'MiniMax-M2.5-Lightning';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const MAX_CONTEXT_CHARS = 150000;

export class AIService {
  private minimaxApiKey: string;
  private queue: PQueue;
  private cache?: AIServiceConfig['redis'];
  private promptBuilder: GamePromptBuilder;

  constructor(config: AIServiceConfig) {
    this.minimaxApiKey = config.minimaxApiKey;
    this.cache = config.redis;
    this.promptBuilder = new GamePromptBuilder();

    // Rate limiting queue
    this.queue = new PQueue({
      concurrency: 5,
      interval: 1000,
      intervalCap: 10
    });
  }

  /** Retry wrapper for fetch with exponential backoff */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries: number = MAX_RETRIES
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (error) {
        const err = error as Error;
        lastError = err;
        if (attempt < retries) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
          console.log(`[MiniMax] Fetch failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms: ${err.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  }

  /** Truncate content to max characters with note */
  private truncateContent(content: string, maxChars: number): string {
    if (content.length <= maxChars) return content;
    return content.slice(0, maxChars) + `\n\n[... TRUNCATED ${content.length - maxChars} chars ...]`;
  }

  /** Truncate message content to stay within budget */
  private truncateMessages(messages: Array<{ role: string; content: string }>, maxChars: number): Array<{ role: string; content: string }> {
    let totalChars = 0;
    const result: Array<{ role: string; content: string }> = [];

    for (const msg of messages) {
      totalChars += msg.content.length;
      if (totalChars > maxChars) {
        const remaining = maxChars - (totalChars - msg.content.length);
        if (remaining > 100) {
          result.push({ ...msg, content: this.truncateContent(msg.content, remaining) });
        }
        break;
      }
      result.push(msg);
    }

    return result;
  }

  async generate(options: GenerateOptions): Promise<AIResponse> {
    // Check cache
    const cacheKey = this.getCacheKey(options);
    if (this.cache) {
      const cached = await this.cache.get<AIResponse>(cacheKey);
      if (cached) {
        console.log('Returning cached AI response');
        return cached;
      }
    }

    // Use queue to respect rate limits - always route to MiniMax
    const response = await this.queue.add(async () => {
      return this.generateWithMiniMax(options);
    });

    if (!response) {
      throw new Error('Failed to generate AI response');
    }

    // Cache the response
    if (this.cache) {
      await this.cache.set(cacheKey, response, 3600); // 1 hour
    }

    return response;
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<string> {
    // Check cache for non-streaming fallback
    const cacheKey = this.getCacheKey(options);
    if (this.cache) {
      const cached = await this.cache.get<AIResponse>(cacheKey);
      if (cached) {
        yield cached.content;
        return;
      }
    }

    // Use queue to respect rate limits - always route to MiniMax
    const stream = await this.queue.add(async () => {
      return this.generateStreamWithMiniMax(options);
    });

    if (!stream) {
      throw new Error('Failed to create AI stream');
    }

    // Stream and collect for caching
    let fullResponse = '';
    const tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for await (const chunk of stream) {
      fullResponse += chunk;
      yield chunk;
    }

    // Cache the complete response
    if (this.cache) {
      const response: AIResponse = {
        content: fullResponse,
        model: options.model,
        usage: tokenUsage
      };
      await this.cache.set(cacheKey, response, 3600);
    }
  }

  async analyze(options: AnalyzeOptions): Promise<any> {
    const response = await this.generate({
      ...options,
      temperature: 0.3 // Lower temperature for more consistent analysis
    });

    if (options.expectedFormat === 'json') {
      try {
        // Try to extract JSON from the response
        const jsonString = this.extractJSON(response.content);
        return JSON.parse(jsonString);
      } catch (error) {
        console.error('Failed to parse AI response as JSON:', error);
        console.error('Response content:', response.content);
        throw new Error('AI response was not valid JSON');
      }
    }

    return response.content;
  }

  /**
   * Extract JSON from AI response that might contain extra text
   */
  private extractJSON(content: string): string {
    // First try to parse the content as-is
    try {
      JSON.parse(content.trim());
      return content.trim();
    } catch (e) {
      // If that fails, try to find JSON within the content
    }

    // Look for JSON object boundaries
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const extracted = content.substring(jsonStart, jsonEnd + 1);

      // Verify it's valid JSON
      try {
        JSON.parse(extracted);
        return extracted;
      } catch (e) {
        // If still invalid, try to find complete JSON blocks
      }
    }

    // Try to find JSON between code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      try {
        JSON.parse(codeBlockMatch[1]);
        return codeBlockMatch[1];
      } catch (e) {
        // Continue to next method
      }
    }

    // Last resort: try to extract anything that looks like JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        JSON.parse(jsonMatch[0]);
        return jsonMatch[0];
      } catch (e) {
        // Give up
      }
    }

    // If all else fails, return the original content and let the outer try/catch handle it
    return content;
  }

  // Generate game-specific content
  async generateGameCode(spec: any, template: any): Promise<string> {
    const prompt = this.promptBuilder.buildGameGenerationPrompt(spec, template);

    const response = await this.generate({
      prompt,
      model: DEFAULT_MODEL,
      temperature: 0.7,
      maxTokens: 8192
    });

    return response.content;
  }

  async analyzeGameRequest(description: string, context?: any): Promise<any> {
    const prompt = this.promptBuilder.buildAnalysisPrompt(description, context);

    return this.analyze({
      prompt,
      model: DEFAULT_MODEL,
      expectedFormat: 'json'
    });
  }

  // MiniMax implementation
  private async generateWithMiniMax(options: GenerateOptions): Promise<AIResponse> {
    const maxTokens = this.getMaxTokensForModel(options.model, options.maxTokens || 8192);

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.prompt });

    // Truncate messages to stay within context limit
    const truncatedMessages = this.truncateMessages(messages, MAX_CONTEXT_CHARS);

    const body = {
      model: options.model || DEFAULT_MODEL,
      max_tokens: maxTokens,
      temperature: options.temperature || 0.7,
      messages: truncatedMessages
    };

    const response = await this.fetchWithRetry(`${MINIMAX_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.minimaxApiKey
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MiniMax API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      id: string;
      type: string;
      role: string;
      content: Array<{ type: string; text?: string }>;
      usage?: {
        input_tokens: number;
        output_tokens: number;
      };
      stop_reason?: string;
    };

    // Extract text content
    let content = '';
    if (data.content) {
      for (const c of data.content) {
        if (c.type === 'text' && c.text) {
          content += c.text;
        }
      }
    }

    return {
      content,
      model: options.model || DEFAULT_MODEL,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      } : undefined
    };
  }

  private async *generateStreamWithMiniMax(
    options: GenerateOptions
  ): AsyncGenerator<string> {
    const maxTokens = this.getMaxTokensForModel(options.model, options.maxTokens || 8192);

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.prompt });

    // Truncate messages to stay within context limit
    const truncatedMessages = this.truncateMessages(messages, MAX_CONTEXT_CHARS);

    const response = await this.fetchWithRetry(`${MINIMAX_BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.minimaxApiKey
      },
      body: JSON.stringify({
        model: options.model || DEFAULT_MODEL,
        max_tokens: maxTokens,
        temperature: options.temperature || 0.7,
        messages: truncatedMessages,
        stream: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MiniMax API error: ${response.status} - ${error}`);
    }

    // Handle streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete events
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            yield parsed.delta.text;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }

  private getCacheKey(options: GenerateOptions | AnalyzeOptions): string {
    return generateCacheKey(
      'ai',
      options.model,
      hashStringSync(options.prompt).substring(0, 16)
    );
  }

  // Health check
  async health(): Promise<boolean> {
    try {
      // Quick test with minimal tokens
      await this.generate({
        prompt: 'Say "OK"',
        model: DEFAULT_MODEL,
        maxTokens: 10
      });
      return true;
    } catch (error) {
      console.error('AI service health check failed:', error);
      return false;
    }
  }

  getMaxTokensForModel(model: string, requestedTokens: number): number {
    // MiniMax-M2.5-Lightning specs: 128K context, 8K output
    const modelLimits: Record<string, number> = {
      'MiniMax-M2.5-Lightning': 8192,
      'MiniMax-M2.5': 8192
    };

    const maxForModel = modelLimits[model] || 8192;
    return Math.min(requestedTokens, maxForModel);
  }
}
