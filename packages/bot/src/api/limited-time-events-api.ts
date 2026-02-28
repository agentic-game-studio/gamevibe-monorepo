import { IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { Container } from 'inversify';
import { LimitedTimeEventService } from '../services/limited-time-events.js';
import { DatabaseService } from '../services/database.js';
import { TYPES } from '../types.js';

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class LimitedTimeEventsAPI {
  private eventService: LimitedTimeEventService;
  private db: DatabaseService;

  constructor(container: Container) {
    this.eventService = container.get<LimitedTimeEventService>(TYPES.LimitedTimeEventService);
    this.db = container.get<DatabaseService>(TYPES.DatabaseService);
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
    // Only handle /api/events/* routes
    if (!pathname.startsWith('/api/events')) {
      return false;
    }

    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const pathParts = pathname.split('/').filter(p => p);

      // Route: GET /api/events
      if (pathParts.length === 2 && req.method === 'GET') {
        await this.handleGetEvents(req, res, url);
        return true;
      }

      // Route: GET /api/events/{eventId}
      if (pathParts.length === 3 && req.method === 'GET') {
        const eventId = pathParts[2];
        await this.handleGetEvent(req, res, eventId);
        return true;
      }

      // Route: POST /api/events/{eventId}/register
      if (pathParts.length === 4 && pathParts[3] === 'register' && req.method === 'POST') {
        const eventId = pathParts[2];
        await this.handleRegisterForEvent(req, res, eventId);
        return true;
      }

      // Route: POST /api/events/{eventId}/submit
      if (pathParts.length === 4 && pathParts[3] === 'submit' && req.method === 'POST') {
        const eventId = pathParts[2];
        await this.handleSubmitToEvent(req, res, eventId);
        return true;
      }

      // Route: GET /api/events/{eventId}/participants
      if (pathParts.length === 4 && pathParts[3] === 'participants' && req.method === 'GET') {
        const eventId = pathParts[2];
        await this.handleGetParticipants(req, res, eventId, url);
        return true;
      }

      // Route: GET /api/events/{eventId}/submissions
      if (pathParts.length === 4 && pathParts[3] === 'submissions' && req.method === 'GET') {
        const eventId = pathParts[2];
        await this.handleGetSubmissions(req, res, eventId, url);
        return true;
      }

      // Route: GET /api/events/{eventId}/leaderboard
      if (pathParts.length === 4 && pathParts[3] === 'leaderboard' && req.method === 'GET') {
        const eventId = pathParts[2];
        await this.handleGetLeaderboard(req, res, eventId, url);
        return true;
      }

      // Route: GET /api/events/{eventId}/templates
      if (pathParts.length === 4 && pathParts[3] === 'templates' && req.method === 'GET') {
        const eventId = pathParts[2];
        await this.handleGetTemplates(req, res, eventId);
        return true;
      }

      // Route: POST /api/events (create event - admin only)
      if (pathParts.length === 2 && req.method === 'POST') {
        await this.handleCreateEvent(req, res);
        return true;
      }

      // Route: PUT /api/events/{eventId}/end (end event - admin only)
      if (pathParts.length === 4 && pathParts[3] === 'end' && req.method === 'PUT') {
        const eventId = pathParts[2];
        await this.handleEndEvent(req, res, eventId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error in Limited-Time Events API:', error);
      this.sendResponse(res, 500, {
        success: false,
        error: 'Internal server error'
      });
      return true;
    }
  }

  private async handleGetEvents(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');

    let events = await this.eventService.getActiveEvents();

    // Apply filters
    if (type && type !== 'all') {
      events = events.filter(e => e.type === type);
    }

    this.sendResponse(res, 200, {
      success: true,
      data: {
        events,
        total: events.length,
        filters: { status, type }
      }
    });
  }

  private async handleGetEvent(req: IncomingMessage, res: ServerResponse, eventId: string): Promise<void> {
    const event = await this.eventService.getEvent(eventId);

    if (!event) {
      this.sendResponse(res, 404, {
        success: false,
        error: 'Event not found'
      });
      return;
    }

    this.sendResponse(res, 200, {
      success: true,
      data: { event }
    });
  }

  private async handleRegisterForEvent(req: IncomingMessage, res: ServerResponse, eventId: string): Promise<void> {
    const body = await this.parseRequestBody(req);
    const { userId, userName } = body;

    if (!userId || !userName) {
      this.sendResponse(res, 400, {
        success: false,
        error: 'Missing required fields: userId, userName'
      });
      return;
    }

    const result = await this.eventService.registerForEvent(eventId, userId, userName);

    this.sendResponse(res, result.success ? 200 : 400, {
      success: result.success,
      message: result.message
    });
  }

  private async handleSubmitToEvent(req: IncomingMessage, res: ServerResponse, eventId: string): Promise<void> {
    const body = await this.parseRequestBody(req);
    const { userId, gameId, description, tags = [] } = body;

    if (!userId || !gameId || !description) {
      this.sendResponse(res, 400, {
        success: false,
        error: 'Missing required fields: userId, gameId, description'
      });
      return;
    }

    const result = await this.eventService.submitToEvent(eventId, userId, gameId, description, tags);

    this.sendResponse(res, result.success ? 200 : 400, {
      success: result.success,
      message: result.message
    });
  }

  private async handleGetParticipants(req: IncomingMessage, res: ServerResponse, eventId: string, url: URL): Promise<void> {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const participants = await this.eventService.getEventParticipants(eventId, limit, offset);

    this.sendResponse(res, 200, {
      success: true,
      data: {
        participants,
        pagination: { limit, offset, total: participants.length }
      }
    });
  }

  private async handleGetSubmissions(req: IncomingMessage, res: ServerResponse, eventId: string, url: URL): Promise<void> {
    const sortBy = url.searchParams.get('sort') as 'recent' | 'votes' | 'random' || 'recent';
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const submissions = await this.eventService.getEventSubmissions(eventId, sortBy, limit);

    this.sendResponse(res, 200, {
      success: true,
      data: {
        submissions,
        sortBy,
        limit
      }
    });
  }

  private async handleGetLeaderboard(req: IncomingMessage, res: ServerResponse, eventId: string, url: URL): Promise<void> {
    const type = url.searchParams.get('type') as 'submissions' | 'votes' | 'engagement' | 'creativity' || 'submissions';

    const leaderboard = await this.eventService.getEventLeaderboard(eventId, type);

    this.sendResponse(res, 200, {
      success: true,
      data: { leaderboard }
    });
  }

  private async handleGetTemplates(req: IncomingMessage, res: ServerResponse, eventId: string): Promise<void> {
    const templates = await this.eventService.getEventTemplates(eventId);

    this.sendResponse(res, 200, {
      success: true,
      data: { templates }
    });
  }

  private async handleCreateEvent(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // TODO: Add admin authentication check
    const body = await this.parseRequestBody(req);

    try {
      const event = await this.eventService.createEvent(body);

      this.sendResponse(res, 201, {
        success: true,
        data: { event },
        message: 'Event created successfully'
      });
    } catch (error) {
      this.sendResponse(res, 400, {
        success: false,
        error: 'Failed to create event'
      });
    }
  }

  private async handleEndEvent(req: IncomingMessage, res: ServerResponse, eventId: string): Promise<void> {
    // TODO: Add admin authentication check
    const result = await this.eventService.endEvent(eventId);

    this.sendResponse(res, result.success ? 200 : 400, {
      success: result.success,
      data: result.results,
      message: result.success ? 'Event ended successfully' : 'Failed to end event'
    });
  }

  private async parseRequestBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });
      
      req.on('error', reject);
    });
  }

  private sendResponse(res: ServerResponse, statusCode: number, data: APIResponse): void {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = statusCode;
    res.end(JSON.stringify(data, null, 2));
  }
}