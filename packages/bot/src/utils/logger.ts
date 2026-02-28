/**
 * Simple logger utility for the GameVibe bot
 */
export class Logger {
  constructor(private context: string) {}

  info(message: string, ...args: any[]): void {
    console.log(`[INFO] [${this.context}] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] [${this.context}] ${message}`, ...args);
  }

  error(message: string, error?: any, ...args: any[]): void {
    console.error(`[ERROR] [${this.context}] ${message}`, error, ...args);
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] [${this.context}] ${message}`, ...args);
    }
  }
}