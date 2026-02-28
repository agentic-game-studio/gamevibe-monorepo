// GameVibe AI Subscription Portal API
// Handles customer portal sessions and subscription management

import { IncomingMessage, ServerResponse } from 'http';
import { Container } from 'inversify';
import { URL } from 'url';
import Stripe from 'stripe';
import { SubscriptionService } from '../services/subscription.js';
import { TYPES } from '../types.js';

export class SubscriptionPortalAPI {
  private subscriptionService: SubscriptionService;
  private stripe: Stripe;

  constructor(container: Container) {
    this.subscriptionService = container.get<SubscriptionService>(TYPES.SubscriptionService);
    
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16'
    });
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    // Handle subscription portal routes
    if (pathname.startsWith('/api/subscription/')) {
      const pathParts = pathname.split('/');
      
      if (pathParts[3] === 'portal' && req.method === 'POST') {
        await this.handlePortalSession(req, res);
        return true;
      }
      
      if (pathParts[3] === 'success' && req.method === 'GET') {
        await this.handleSubscriptionSuccess(req, res);
        return true;
      }
      
      if (pathParts[3] === 'cancel' && req.method === 'GET') {
        await this.handleSubscriptionCancel(req, res);
        return true;
      }
      
      if (pathParts[3] === 'status' && req.method === 'GET') {
        await this.handleSubscriptionStatus(req, res);
        return true;
      }
    }

    return false;
  }

  /**
   * Create a Stripe customer portal session for subscription management
   */
  private async handlePortalSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.parseRequestBody(req);
      const { serverId, userId } = body;

      if (!serverId) {
        this.sendResponse(res, 400, { error: 'Server ID is required' });
        return;
      }

      // Get subscription
      const subscription = await this.subscriptionService.getServerSubscription(serverId);
      
      if (!subscription.stripeCustomerId) {
        this.sendResponse(res, 404, { 
          error: 'No subscription found for this server',
          message: 'Please subscribe first using /subscription upgrade'
        });
        return;
      }

      // Create customer portal session
      const session = await this.stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${process.env.APP_URL || 'http://localhost:3000'}/subscription/dashboard?server=${serverId}`
      });

      this.sendResponse(res, 200, { 
        url: session.url,
        message: 'Portal session created successfully'
      });

    } catch (error) {
      console.error('Portal session error:', error);
      this.sendResponse(res, 500, { 
        error: 'Failed to create portal session',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle successful subscription completion
   */
  private async handleSubscriptionSuccess(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('session_id');

    if (!sessionId) {
      this.sendHtmlResponse(res, 400, 'Missing session ID', 'Invalid request');
      return;
    }

    try {
      // Retrieve the checkout session
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      const { serverId } = session.metadata || {};

      if (!serverId) {
        this.sendHtmlResponse(res, 400, 'Invalid session', 'Session does not contain server information');
        return;
      }

      // Get updated subscription
      const subscription = await this.subscriptionService.getServerSubscription(serverId);

      // Send success page
      this.sendHtmlResponse(res, 200, 'Subscription Activated! 🎉', `
        <div class="success-content">
          <h2>Welcome to ${subscription.tier.toUpperCase()} tier!</h2>
          <p>Your Discord server has been upgraded successfully.</p>
          
          <div class="next-steps">
            <h3>What's Next?</h3>
            <ul>
              <li>Go back to Discord and try <code>/create-game</code></li>
              <li>Check your new features with <code>/subscription info</code></li>
              <li>Invite more members to enjoy premium features!</li>
            </ul>
          </div>
          
          <div class="support">
            <p>Need help? Contact support or check our documentation.</p>
          </div>
        </div>
        
        <script>
          // Auto-close after 10 seconds
          setTimeout(() => {
            window.close();
          }, 10000);
        </script>
      `);

    } catch (error) {
      console.error('Subscription success error:', error);
      this.sendHtmlResponse(res, 500, 'Error Processing Subscription', 
        'There was an error processing your subscription. Please contact support.');
    }
  }

  /**
   * Handle subscription cancellation
   */
  private async handleSubscriptionCancel(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.sendHtmlResponse(res, 200, 'Subscription Cancelled', `
      <div class="cancel-content">
        <h2>Subscription Cancelled</h2>
        <p>You cancelled the subscription process. No charges were made.</p>
        
        <div class="actions">
          <p>You can try again anytime using <code>/subscription upgrade</code> in Discord.</p>
        </div>
        
        <div class="support">
          <p>Questions? Contact our support team.</p>
        </div>
      </div>
      
      <script>
        // Auto-close after 5 seconds
        setTimeout(() => {
          window.close();
        }, 5000);
      </script>
    `);
  }

  /**
   * Get subscription status for a server
   */
  private async handleSubscriptionStatus(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const serverId = url.searchParams.get('server');

    if (!serverId) {
      this.sendResponse(res, 400, { error: 'Server ID is required' });
      return;
    }

    try {
      const subscription = await this.subscriptionService.getServerSubscription(serverId);
      
      // Return public subscription info
      this.sendResponse(res, 200, {
        tier: subscription.tier,
        status: subscription.status,
        gamesThisMonth: subscription.gamesCreatedThisPeriod,
        features: subscription.features,
        nextRenewal: subscription.currentPeriodEnd,
        isActive: subscription.status === 'ACTIVE'
      });

    } catch (error) {
      console.error('Subscription status error:', error);
      this.sendResponse(res, 500, { 
        error: 'Failed to get subscription status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async parseRequestBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Invalid JSON in request body'));
        }
      });
      
      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  private sendResponse(res: ServerResponse, statusCode: number, data: any): void {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = statusCode;
    res.end(JSON.stringify(data, null, 2));
  }

  private sendHtmlResponse(res: ServerResponse, statusCode: number, title: string, content: string): void {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - GameVibe AI</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            max-width: 500px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
        }
        h1 {
            color: #667eea;
            margin-bottom: 20px;
        }
        h2 {
            color: #555;
            margin-bottom: 15px;
        }
        h3 {
            color: #667eea;
            margin-top: 25px;
            margin-bottom: 10px;
        }
        .success-content {
            color: #155724;
        }
        .cancel-content {
            color: #721c24;
        }
        ul {
            text-align: left;
            margin: 15px 0;
        }
        li {
            margin: 8px 0;
        }
        code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Menlo', monospace;
        }
        .support {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
        }
        .actions {
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        ${content}
    </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.statusCode = statusCode;
    res.end(html);
  }
}