import { Game } from '@gamevibe/shared';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    username: string;
    discriminator?: string;
    avatar?: string;
  };
}

export interface SessionJoinRequest {
  gameId: string;
  channelId: string;
  player: {
    id: string;
    username: string;
    discriminator?: string;
    avatar?: string;
  };
}

export interface SessionResponse {
  id: string;
  gameId: string;
  channelId: string;
  players: Array<{
    id: string;
    username: string;
    discriminator?: string;
    avatar?: string;
    isHost: boolean;
    score: number;
    status: string;
  }>;
  state: any;
  isActive: boolean;
  startedAt: string;
}

export interface GameStats {
  id: string;
  playCount: number;
  averageScore: number;
  topScore: number;
  recentPlays: Array<{
    playerId: string;
    score: number;
    playedAt: string;
  }>;
}

export class APIClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private currentUser: AuthResponse['user'] | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  setCurrentUser(user: AuthResponse['user']): void {
    this.currentUser = user;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorData.error || errorData.message || 'Unknown error'}`
      );
    }

    return response.json();
  }

  // Authentication
  async exchangeCode(code: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/discord/callback', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken })
    });
  }

  // Game management
  async getGame(gameId: string): Promise<Game> {
    const response = await this.request<any>(`/api/games/${gameId}`);
    // Convert date strings to Date objects for proper typing
    return {
      ...response,
      createdAt: new Date(response.createdAt),
      updatedAt: new Date(response.updatedAt)
    } as Game;
  }

  async getRecentGames(limit: number = 10): Promise<Game[]> {
    return this.request<Game[]>(`/api/games/recent?limit=${limit}`);
  }

  async getPopularGames(limit: number = 10): Promise<Game[]> {
    return this.request<Game[]>(`/api/games/popular?limit=${limit}`);
  }

  async getGameStats(gameId: string): Promise<GameStats> {
    return this.request<GameStats>(`/api/games/${gameId}/stats`);
  }

  // Session management
  async joinGameSession(request: SessionJoinRequest): Promise<SessionResponse> {
    return this.request<SessionResponse>('/api/sessions/join', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async leaveGameSession(sessionId: string): Promise<void> {
    await this.request(`/api/sessions/${sessionId}/leave`, {
      method: 'POST'
    });
  }

  async sendHeartbeat(sessionId: string): Promise<void> {
    await this.request(`/api/sessions/${sessionId}/heartbeat`, {
      method: 'POST'
    });
  }

  async updatePlayerScore(sessionId: string, score: number): Promise<void> {
    await this.request(`/api/sessions/${sessionId}/score`, {
      method: 'POST',
      body: JSON.stringify({ score })
    });
  }

  async sendSessionMessage(sessionId: string, message: any): Promise<void> {
    await this.request(`/api/sessions/${sessionId}/message`, {
      method: 'POST',
      body: JSON.stringify(message)
    });
  }

  async getSessionMessages(sessionId: string, since?: number): Promise<any[]> {
    const params = since ? `?since=${since}` : '';
    return this.request<any[]>(`/api/sessions/${sessionId}/messages${params}`);
  }

  // Leaderboards
  async submitScore(gameId: string, score: number, metadata?: any): Promise<void> {
    // Get current user ID from access token (assuming it's a JWT with user info)
    const userId = this.getUserIdFromToken();
    
    await this.request(`/api/leaderboard/${gameId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ userId, score, metadata })
    });
  }

  async getLeaderboard(gameId: string, limit: number = 10, offset: number = 0): Promise<any> {
    return this.request<any>(`/api/leaderboard/${gameId}?limit=${limit}&offset=${offset}`);
  }

  async getUserRank(gameId: string, userId: string): Promise<{ rank: number | null }> {
    return this.request<{ rank: number | null }>(`/api/leaderboard/${gameId}/rank/${userId}`);
  }

  async getLeaderboardStats(gameId: string): Promise<any> {
    return this.request<any>(`/api/leaderboard/${gameId}/stats`);
  }

  private getUserIdFromToken(): string {
    if (!this.currentUser) {
      throw new Error('No user information available');
    }
    
    return this.currentUser.id;
  }

  // Analytics
  async trackGameStart(gameId: string): Promise<void> {
    await this.request(`/api/analytics/game-start`, {
      method: 'POST',
      body: JSON.stringify({ 
        gameId, 
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      })
    });
  }

  async trackGameEnd(gameId: string, score: number, duration: number): Promise<void> {
    await this.request(`/api/analytics/game-end`, {
      method: 'POST',
      body: JSON.stringify({ 
        gameId, 
        score,
        duration,
        timestamp: Date.now()
      })
    });
  }

  async trackEvent(event: string, data: any): Promise<void> {
    await this.request(`/api/analytics/event`, {
      method: 'POST',
      body: JSON.stringify({ 
        event, 
        data,
        timestamp: Date.now()
      })
    });
  }

  // Health check
  async health(): Promise<{ status: string; timestamp: number }> {
    return this.request<{ status: string; timestamp: number }>('/api/health');
  }

  // WebSocket connection for real-time features
  createWebSocket(sessionId: string): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/api/sessions/${sessionId}/ws`);
    
    ws.onopen = () => {
      console.log('🔌 WebSocket connected');
      
      // Send authentication
      if (this.accessToken) {
        ws.send(JSON.stringify({
          type: 'auth',
          token: this.accessToken
        }));
      }
    };

    ws.onclose = (event) => {
      console.log('🔌 WebSocket disconnected:', event.code, event.reason);
    };

    ws.onerror = (error) => {
      console.error('🔌 WebSocket error:', error);
    };

    return ws;
  }
}