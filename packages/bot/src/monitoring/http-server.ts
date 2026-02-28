import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { Container } from 'inversify';
import { HealthService } from '../services/health.js';
import { LeaderboardAPI } from '../api/leaderboard-routes.js';
import { AnalyticsAPI } from '../api/analytics-routes.js';
import { StripeWebhookAPI } from '../api/stripe-webhook.js';
import { SubscriptionPortalAPI } from '../api/subscription-portal.js';
import { SocialPreviewAPI } from '../api/social-preview-api.js';
import { EmbedAPI } from '../api/embed-api.js';
import { ServerRankingsAPI } from '../api/server-rankings-api.js';
import { SEOLandingPagesAPI } from '../api/seo-landing-pages-api.js';
import { LimitedTimeEventsAPI } from '../api/limited-time-events-api.js';
import { BotListingWebhooksAPI } from '../api/bot-listing-webhooks.js';
import { EnterpriseAPI } from '../api/enterprise-api.js';
import { EnterpriseDocsAPI } from '../api/enterprise-docs.js';
import { EnterpriseWebhooksAPI } from '../api/enterprise-webhooks.js';
import { GamesAPI } from '../api/games-api.js';
import { TYPES } from '../types.js';

export class MonitoringHTTPServer {
  private server: ReturnType<typeof createServer>;
  private port: number;
  private healthService: HealthService;
  private leaderboardAPI: LeaderboardAPI;
  private analyticsAPI: AnalyticsAPI;
  private stripeWebhookAPI: StripeWebhookAPI;
  private subscriptionPortalAPI: SubscriptionPortalAPI;
  private socialPreviewAPI: SocialPreviewAPI;
  private embedAPI: EmbedAPI;
  private serverRankingsAPI: ServerRankingsAPI;
  private seoLandingPagesAPI: SEOLandingPagesAPI;
  private limitedTimeEventsAPI: LimitedTimeEventsAPI;
  private botListingWebhooksAPI: BotListingWebhooksAPI;
  private enterpriseAPI: EnterpriseAPI;
  private enterpriseDocsAPI: EnterpriseDocsAPI;
  private enterpriseWebhooksAPI: EnterpriseWebhooksAPI;
  private gamesAPI: GamesAPI;

  constructor(container: Container, port = 8080) {
    this.healthService = container.get<HealthService>(TYPES.HealthService);
    this.leaderboardAPI = new LeaderboardAPI(container);
    this.analyticsAPI = new AnalyticsAPI(container);
    this.stripeWebhookAPI = new StripeWebhookAPI(container);
    this.subscriptionPortalAPI = new SubscriptionPortalAPI(container);
    this.socialPreviewAPI = new SocialPreviewAPI(container);
    this.embedAPI = new EmbedAPI(container);
    this.serverRankingsAPI = new ServerRankingsAPI(container);
    this.seoLandingPagesAPI = new SEOLandingPagesAPI(container);
    this.limitedTimeEventsAPI = new LimitedTimeEventsAPI(container);
    this.botListingWebhooksAPI = new BotListingWebhooksAPI(container);
    this.enterpriseAPI = new EnterpriseAPI(container);
    this.enterpriseDocsAPI = new EnterpriseDocsAPI();
    this.enterpriseWebhooksAPI = new EnterpriseWebhooksAPI(container);
    this.gamesAPI = new GamesAPI(container);
    this.port = port;
    this.server = createServer(this.handleRequest.bind(this));
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }

    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const pathname = url.pathname;

      // Try Enterprise API routes first (highest priority for enterprise clients)
      const enterpriseHandled = await this.enterpriseAPI.handleRequest(req, res, pathname);
      if (enterpriseHandled) {
        return;
      }

      // Try Enterprise Documentation routes
      const enterpriseDocsHandled = await this.enterpriseDocsAPI.handleRequest(req, res, pathname);
      if (enterpriseDocsHandled) {
        return;
      }

      // Try leaderboard API routes
      const leaderboardHandled = await this.leaderboardAPI.handleRequest(req, res, pathname);
      if (leaderboardHandled) {
        return;
      }

      // Try analytics API routes
      const analyticsHandled = await this.analyticsAPI.handleRequest(req, res, pathname);
      if (analyticsHandled) {
        return;
      }

      // Try games API routes
      const gamesHandled = await this.gamesAPI.handleRequest(req, res, pathname);
      if (gamesHandled) {
        return;
      }

      // Try Stripe webhook routes
      const webhookHandled = await this.stripeWebhookAPI.handleRequest(req, res, pathname);
      if (webhookHandled) {
        return;
      }

      // Try subscription portal routes
      const portalHandled = await this.subscriptionPortalAPI.handleRequest(req, res, pathname);
      if (portalHandled) {
        return;
      }

      // Try social preview API routes
      const socialPreviewHandled = await this.socialPreviewAPI.handleRequest(req, res, pathname);
      if (socialPreviewHandled) {
        return;
      }

      // Try embed API routes
      const embedHandled = await this.embedAPI.handleRequest(req, res, pathname);
      if (embedHandled) {
        return;
      }

      // Try server rankings API routes
      const rankingsHandled = await this.serverRankingsAPI.handleRequest(req, res, pathname);
      if (rankingsHandled) {
        return;
      }

      // Try bot listing webhook routes
      const botListingHandled = await this.botListingWebhooksAPI.handleRequest(req, res, pathname);
      if (botListingHandled) {
        return;
      }

      // Try SEO landing pages API routes
      const seoHandled = await this.seoLandingPagesAPI.handleRequest(req, res, pathname);
      if (seoHandled) {
        return;
      }

      // Try limited-time events API routes
      const eventsHandled = await this.limitedTimeEventsAPI.handleRequest(req, res, pathname);
      if (eventsHandled) {
        return;
      }

      // Only allow GET requests for monitoring endpoints
      if (req.method !== 'GET') {
        this.sendResponse(res, 405, { error: 'Method not allowed' });
        return;
      }

      switch (pathname) {
        case '/health':
          await this.handleHealth(res);
          break;
        
        case '/health/live':
          await this.handleLiveness(res);
          break;
        
        case '/health/ready':
          await this.handleReadiness(res);
          break;
        
        case '/metrics':
          await this.handleMetrics(res);
          break;
        
        case '/':
        case '/status':
          await this.handleStatus(res);
          break;
        
        default:
          this.sendResponse(res, 404, { error: 'Not found' });
          break;
      }
    } catch (error) {
      console.error('Error handling monitoring request:', error);
      this.sendResponse(res, 500, { error: 'Internal server error' });
    }
  }

  private async handleHealth(res: ServerResponse): Promise<void> {
    try {
      const healthStatus = await this.healthService.getHealthStatus();
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;
      
      this.sendResponse(res, statusCode, healthStatus);
    } catch (error) {
      this.sendResponse(res, 503, { 
        status: 'unhealthy', 
        error: 'Health check failed',
        timestamp: Date.now()
      });
    }
  }

  private async handleLiveness(res: ServerResponse): Promise<void> {
    const isAlive = this.healthService.isAlive();
    this.sendResponse(res, isAlive ? 200 : 503, {
      status: isAlive ? 'alive' : 'dead',
      timestamp: Date.now()
    });
  }

  private async handleReadiness(res: ServerResponse): Promise<void> {
    try {
      const isReady = await this.healthService.isReady();
      this.sendResponse(res, isReady ? 200 : 503, {
        status: isReady ? 'ready' : 'not ready',
        timestamp: Date.now()
      });
    } catch (error) {
      this.sendResponse(res, 503, {
        status: 'not ready',
        error: 'Readiness check failed',
        timestamp: Date.now()
      });
    }
  }

  private async handleMetrics(res: ServerResponse): Promise<void> {
    try {
      const metrics = this.healthService.getMetrics();
      
      // Format as Prometheus-style metrics
      const prometheusMetrics = this.formatPrometheusMetrics(metrics);
      
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.statusCode = 200;
      res.end(prometheusMetrics);
    } catch (error) {
      this.sendResponse(res, 500, { error: 'Failed to get metrics' });
    }
  }

  private async handleStatus(res: ServerResponse): Promise<void> {
    const status = {
      service: 'GameVibe Bot',
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
      timestamp: Date.now(),
      pid: process.pid,
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV || 'development'
    };

    this.sendResponse(res, 200, status);
  }

  private formatPrometheusMetrics(metrics: any): string {
    const timestamp = Date.now();
    
    return `
# HELP gamevibe_uptime_seconds Total uptime in seconds
# TYPE gamevibe_uptime_seconds counter
gamevibe_uptime_seconds ${Math.floor(metrics.uptime / 1000)} ${timestamp}

# HELP gamevibe_games_generated_total Total number of games generated
# TYPE gamevibe_games_generated_total counter
gamevibe_games_generated_total ${metrics.gamesGenerated} ${timestamp}

# HELP gamevibe_active_users Current number of active users
# TYPE gamevibe_active_users gauge
gamevibe_active_users ${metrics.activeUsers} ${timestamp}

# HELP gamevibe_memory_usage_bytes Memory usage in bytes
# TYPE gamevibe_memory_usage_bytes gauge
gamevibe_memory_usage_bytes{type="rss"} ${metrics.memoryUsage.rss} ${timestamp}
gamevibe_memory_usage_bytes{type="heapUsed"} ${metrics.memoryUsage.heapUsed} ${timestamp}
gamevibe_memory_usage_bytes{type="heapTotal"} ${metrics.memoryUsage.heapTotal} ${timestamp}
gamevibe_memory_usage_bytes{type="external"} ${metrics.memoryUsage.external} ${timestamp}

# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total ${process.cpuUsage().user / 1000000} ${timestamp}
    `.trim();
  }

  private sendResponse(res: ServerResponse, statusCode: number, data: any): void {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = statusCode;
    res.end(JSON.stringify(data, null, 2));
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`📊 Monitoring server listening on port ${this.port}`);
          console.log(`   Health: http://localhost:${this.port}/health`);
          console.log(`   Liveness: http://localhost:${this.port}/health/live`);
          console.log(`   Readiness: http://localhost:${this.port}/health/ready`);
          console.log(`   Metrics: http://localhost:${this.port}/metrics`);
          console.log(`🏢 Enterprise API available:`);
          console.log(`   Documentation: http://localhost:${this.port}/api/v1/enterprise/docs`);
          console.log(`   OpenAPI Spec: http://localhost:${this.port}/api/v1/enterprise/openapi.json`);
          console.log(`   Status: http://localhost:${this.port}/api/v1/enterprise/status`);
          resolve();
        }
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('📊 Monitoring server stopped');
        resolve();
      });
    });
  }
}