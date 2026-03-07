export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private format(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${this.context}] ${message}${metaStr}`;
  }

  info(message: string, meta?: any): void {
    console.log(this.format('INFO', message, meta));
  }

  warn(message: string, meta?: any): void {
    console.warn(this.format('WARN', message, meta));
  }

  error(message: string, meta?: any): void {
    console.error(this.format('ERROR', message, meta));
  }

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(this.format('DEBUG', message, meta));
    }
  }
}
