import { injectable } from 'inversify';

// Mock analytics service until PostHog is set up
@injectable()
export class AnalyticsService {
  private events: Array<{ event: string; properties: any; timestamp: Date }> = [];
  
  async track(event: string, properties?: any): Promise<void> {
    const analyticsEvent = {
      event,
      properties: {
        ...properties,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    };
    
    this.events.push(analyticsEvent);
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Analytics Event: ${event}`, properties);
    }
    
    // Clean up old events if too many
    if (this.events.length > 10000) {
      this.events = this.events.slice(-5000);
    }
  }
  
  async identify(userId: string, traits?: any): Promise<void> {
    await this.track('user_identified', {
      userId,
      ...traits
    });
  }
  
  async getEvents(filter?: { event?: string; limit?: number }): Promise<any[]> {
    let filtered = this.events;
    
    if (filter?.event) {
      filtered = filtered.filter(e => e.event === filter.event);
    }
    
    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }
    
    return filtered;
  }
}