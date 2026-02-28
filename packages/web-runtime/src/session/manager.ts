import { EventEmitter } from '../utils/event-emitter.js';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { APIClient } from '../api/client.js';

export interface Player {
  id: string;
  username: string;
  discriminator?: string;
  avatar?: string;
  isHost: boolean;
  score: number;
  status: 'active' | 'inactive' | 'spectating';
}

export interface GameSession {
  id: string;
  gameId: string;
  channelId: string;
  players: Player[];
  state: any;
  isActive: boolean;
  startedAt: Date;
}

export class SessionManager extends EventEmitter {
  private discordSdk: DiscordSDK;
  private apiClient: APIClient;
  private currentSession: GameSession | null = null;
  public currentGameId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private localPlayer: Player | null = null;

  constructor(discordSdk: DiscordSDK, apiClient: APIClient) {
    super();
    this.discordSdk = discordSdk;
    this.apiClient = apiClient;
  }

  async initialize(): Promise<void> {
    // Get current user info through authentication
    const authResult = await this.discordSdk.commands.authenticate({
      access_token: null
    });
    
    this.localPlayer = {
      id: authResult.user.id,
      username: authResult.user.username,
      discriminator: authResult.user.discriminator,
      avatar: authResult.user.avatar || undefined,
      isHost: false,
      score: 0,
      status: 'active'
    };

    console.log('👤 Local player initialized:', this.localPlayer.username);
  }

  async joinGame(gameId: string): Promise<void> {
    try {
      this.currentGameId = gameId;
      
      // Get current Discord channel/guild info
      const channelId = await this.getCurrentChannelId();
      
      // Join or create session via API
      const session = await this.apiClient.joinGameSession({
        gameId,
        channelId,
        player: this.localPlayer!
      });

      this.currentSession = {
        ...session,
        players: session.players.map(p => ({
          ...p,
          status: p.status as 'active' | 'inactive' | 'spectating'
        })),
        startedAt: new Date(session.startedAt)
      };

      console.log(`🎯 Joined game session: ${session.id}`);

      // Start heartbeat to maintain session
      this.startHeartbeat();

      // Setup Discord activity
      await this.updateDiscordActivity();

      // Notify listeners
      this.emit('sessionJoined', this.currentSession);

    } catch (error) {
      console.error('❌ Failed to join game session:', error);
      throw error;
    }
  }

  private async getCurrentChannelId(): Promise<string> {
    try {
      const instanceId = await this.discordSdk.commands.getInstanceConnectedParticipants();
      return instanceId.participants[0]?.id || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      if (this.currentSession) {
        try {
          await this.apiClient.sendHeartbeat(this.currentSession.id);
        } catch (error) {
          console.warn('Heartbeat failed:', error);
        }
      }
    }, 30000); // 30 seconds
  }

  async updateScore(score: number): Promise<void> {
    if (!this.localPlayer || !this.currentSession) return;

    this.localPlayer.score = score;

    try {
      // Update score via API
      await this.apiClient.updatePlayerScore(this.currentSession.id, score);

      // Update Discord activity
      await this.updateDiscordActivity();

      this.emit('scoreUpdated', score);
    } catch (error) {
      console.error('Failed to update score:', error);
    }
  }

  async sendMessage(data: any): Promise<void> {
    if (!this.currentSession) return;

    try {
      await this.apiClient.sendSessionMessage(this.currentSession.id, {
        type: 'game_data',
        data,
        playerId: this.localPlayer!.id,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  handleParticipantsUpdate(participants: any[]): void {
    if (!this.currentSession) return;

    console.log('👥 Participants updated:', participants.length);

    // Update local session state
    const updatedPlayers = participants.map(p => ({
      id: p.id,
      username: p.username,
      discriminator: p.discriminator,
      avatar: p.avatar,
      isHost: p.id === this.currentSession!.players[0]?.id,
      score: this.currentSession!.players.find(player => player.id === p.id)?.score || 0,
      status: 'active' as const
    }));

    // Find new and leaving players
    const currentPlayerIds = this.currentSession.players.map(p => p.id);
    const newPlayerIds = updatedPlayers.map(p => p.id);

    const joinedPlayers = updatedPlayers.filter(p => !currentPlayerIds.includes(p.id));
    const leftPlayers = this.currentSession.players.filter(p => !newPlayerIds.includes(p.id));

    // Update session
    this.currentSession.players = updatedPlayers;

    // Emit events
    joinedPlayers.forEach(player => {
      this.emit('playerJoined', player);
    });

    leftPlayers.forEach(player => {
      this.emit('playerLeft', player);
    });

    this.emit('participantsUpdated', updatedPlayers);
  }

  private async updateDiscordActivity(): Promise<void> {
    if (!this.currentSession || !this.localPlayer) return;

    try {
      const activity = {
        details: `Playing ${this.currentSession.gameId}`,
        state: `Score: ${this.localPlayer.score}`,
        timestamps: {
          start: this.currentSession.startedAt.getTime()
        },
        party: {
          id: this.currentSession.id,
          size: [this.currentSession.players.length, 8] // max 8 players
        },
        assets: {
          large_image: 'gamevibe_logo',
          large_text: 'GameVibe AI'
        }
      };

      await this.discordSdk.commands.setActivity({ activity });
    } catch (error) {
      console.warn('Failed to update Discord activity:', error);
    }
  }

  async leaveSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      console.log('👋 Leaving game session');

      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Leave session via API
      await this.apiClient.leaveGameSession(this.currentSession.id);

      // Clear Discord activity
      await this.discordSdk.commands.setActivity({ activity: null });

      // Clean up
      const sessionId = this.currentSession.id;
      this.currentSession = null;
      this.currentGameId = null;

      this.emit('sessionLeft', sessionId);

    } catch (error) {
      console.error('Failed to leave session:', error);
    }
  }

  getCurrentSession(): GameSession | null {
    return this.currentSession;
  }

  getPlayers(): Player[] {
    return this.currentSession?.players || [];
  }

  getLocalPlayer(): Player | null {
    return this.localPlayer;
  }

  isHost(): boolean {
    return this.localPlayer?.isHost || false;
  }

  isInSession(): boolean {
    return this.currentSession !== null;
  }
}