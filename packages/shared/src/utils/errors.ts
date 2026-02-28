import { ERROR_CODES } from '../constants/index.js';

export class GameVibeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'GameVibeError';
  }
}

export class ValidationError extends GameVibeError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.INVALID_INPUT, 400, details);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends GameVibeError {
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, ERROR_CODES.RATE_LIMITED, 429, { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class GenerationError extends GameVibeError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.GENERATION_FAILED, 500, details);
    this.name = 'GenerationError';
  }
}

export class UnauthorizedError extends GameVibeError {
  constructor(message: string = 'Unauthorized') {
    super(message, ERROR_CODES.UNAUTHORIZED, 401);
    this.name = 'UnauthorizedError';
  }
}

export const isGameVibeError = (error: any): error is GameVibeError => {
  return error instanceof GameVibeError;
};

export const formatErrorResponse = (error: any) => {
  if (isGameVibeError(error)) {
    return {
      error: true,
      code: error.code,
      message: error.message,
      details: error.details
    };
  }
  
  return {
    error: true,
    code: ERROR_CODES.SERVER_ERROR,
    message: 'An unexpected error occurred',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  };
};