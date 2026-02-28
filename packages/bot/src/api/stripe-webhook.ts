// GameVibe AI Stripe Webhook Handler
// Processes Stripe webhook events for subscription management

import { IncomingMessage, ServerResponse } from 'http';
import { Container } from 'inversify';
import Stripe from 'stripe';
import { SubscriptionService } from '../services/subscription.js';
import { TYPES } from '../types.js';

export class StripeWebhookAPI {
  private subscriptionService: SubscriptionService;
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(container: Container) {
    this.subscriptionService = container.get<SubscriptionService>(TYPES.SubscriptionService);
    
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16'
    });

    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    if (!this.webhookSecret) {
      console.warn('STRIPE_WEBHOOK_SECRET not set - webhook signature verification disabled');
    }
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    if (pathname !== '/webhook/stripe') {
      return false;
    }

    if (req.method !== 'POST') {
      this.sendResponse(res, 405, { error: 'Method not allowed' });
      return true;
    }

    try {
      // Get raw body
      const body = await this.getRawBody(req);
      
      // Verify webhook signature
      let event: Stripe.Event;
      
      if (this.webhookSecret) {
        const signature = req.headers['stripe-signature'] as string;
        if (!signature) {
          this.sendResponse(res, 400, { error: 'Missing stripe-signature header' });
          return true;
        }

        try {
          event = this.stripe.webhooks.constructEvent(body, signature, this.webhookSecret);
        } catch (err) {
          console.error('Webhook signature verification failed:', err);
          this.sendResponse(res, 400, { error: 'Invalid signature' });
          return true;
        }
      } else {
        // Parse without verification (development only)
        try {
          event = JSON.parse(body.toString());
        } catch (err) {
          this.sendResponse(res, 400, { error: 'Invalid JSON' });
          return true;
        }
      }

      // Process the webhook event
      await this.processWebhook(event);
      
      this.sendResponse(res, 200, { received: true });
      return true;

    } catch (error) {
      console.error('Stripe webhook error:', error);
      this.sendResponse(res, 400, { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      return true;
    }
  }

  private async processWebhook(event: Stripe.Event): Promise<void> {
    console.log(`🔗 Processing Stripe webhook: ${event.type} (${event.id})`);

    try {
      // Handle the event
      await this.subscriptionService.handleSubscriptionWebhook(event);
      
      // Log successful processing
      console.log(`✅ Successfully processed webhook: ${event.type}`);
      
    } catch (error) {
      console.error(`❌ Failed to process webhook ${event.type}:`, error);
      
      // Re-throw to send error response
      throw error;
    }
  }

  private async getRawBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      req.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      
      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  private sendResponse(res: ServerResponse, statusCode: number, data: any): void {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = statusCode;
    res.end(JSON.stringify(data));
  }
}

// Webhook event types we handle
export const HANDLED_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed'
] as const;