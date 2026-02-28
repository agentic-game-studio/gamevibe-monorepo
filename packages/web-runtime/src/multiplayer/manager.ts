import * as Colyseus from 'colyseus.js';
import { EventEmitter } from '../utils/event-emitter.js';
import { logger } from '@gamevibe/shared';

const log = logger('MultiplayerManager');

export interface MultiplayerConfig {
  url: string;
  roomCode: string;
  token: string;
  gameId: string;
}

export interface PlayerData {
  id: string;
  username: string;
  avatar?: string;
  x: number;
  y: number;
  score: number;
  state: string;
}

export interface GameStateData {
  players: Map<string, PlayerData>;
  status: 'waiting' | 'playing' | 'finished';
  startTime: number;
  elapsedTime: number;
  winnerId?: string;
}

export class MultiplayerManager extends EventEmitter {
  private client: Colyseus.Client | null = null;
  private room: Colyseus.Room | null = null;
  private config: MultiplayerConfig | null = null;
  private localPlayerId: string | null = null;
  private isConnected: boolean = false;

  constructor() {
    super();
  }

  async connect(config: MultiplayerConfig): Promise<void> {
    try {
      this.config = config;
      
      // Extract base URL from WebSocket URL
      const httpUrl = config.url.replace('ws://', 'http://').replace('wss://', 'https://');
      this.client = new Colyseus.Client(httpUrl);

      log.info(`Connecting to multiplayer server at ${httpUrl}`);

      // Join the room with authentication
      this.room = await this.client.joinOrCreate('game_room', {
        gameId: config.gameId,
        token: config.token
      });

      this.localPlayerId = this.room.sessionId;
      this.isConnected = true;

      this.setupRoomHandlers();
      
      log.info(`Connected to room ${(this.room as any).roomId || this.room.sessionId} as player ${this.localPlayerId}`);
      this.emit('connected', { roomId: (this.room as any).roomId || this.room.sessionId, playerId: this.localPlayerId });

    } catch (error) {
      log.error('Failed to connect to multiplayer server:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private setupRoomHandlers(): void {
    if (!this.room) return;

    // Handle state changes
    this.room.onStateChange((state) => {
      const gameState: GameStateData = {
        players: state.players,
        status: state.status,
        startTime: state.startTime,
        elapsedTime: state.elapsedTime,
        winnerId: state.winnerId
      };
      this.emit('stateChanged', gameState);
    });

    // Handle player join
    this.room.state.players.onAdd((player: PlayerData, key: string) => {
      log.info(`Player ${player.username} (${key}) joined`);
      this.emit('playerJoined', { playerId: key, player });
    });

    // Handle player leave
    this.room.state.players.onRemove((player: PlayerData, key: string) => {
      log.info(`Player ${player.username} (${key}) left`);
      this.emit('playerLeft', { playerId: key, player });
    });

    // Handle player updates
    this.room.state.players.onChange((player: PlayerData, key: string) => {
      if (key !== this.localPlayerId) {
        this.emit('playerUpdated', { playerId: key, player });
      }
    });

    // Handle messages
    this.room.onMessage('joined', (data) => {
      this.emit('joined', data);
    });

    this.room.onMessage('ready_check', (data) => {
      this.emit('readyCheck', data);
    });

    this.room.onMessage('game_started', (data) => {
      this.emit('gameStarted', data);
    });

    this.room.onMessage('game_ended', (data) => {
      this.emit('gameEnded', data);
    });

    this.room.onMessage('score_updated', (data) => {
      this.emit('scoreUpdated', data);
    });

    this.room.onMessage('player_action', (data) => {
      this.emit('playerAction', data);
    });

    // Handle errors
    this.room.onError((code, message) => {
      log.error(`Room error ${code}: ${message}`);
      this.emit('error', { code, message });
    });

    // Handle leave
    this.room.onLeave((code) => {
      log.info(`Left room with code ${code}`);
      this.isConnected = false;
      this.emit('disconnected', { code });
    });
  }

  sendReady(): void {
    if (!this.room || !this.isConnected) return;
    this.room.send('player_ready', {});
  }

  sendMove(x: number, y: number): void {
    if (!this.room || !this.isConnected) return;
    this.room.send('player_move', { x, y });
  }

  sendAction(action: string, payload?: any): void {
    if (!this.room || !this.isConnected) return;
    this.room.send('player_action', { action, payload });
  }

  updateScore(score: number): void {
    if (!this.room || !this.isConnected) return;
    this.room.send('update_score', { score });
  }

  endGame(finalScore?: number): void {
    if (!this.room || !this.isConnected) return;
    this.room.send('player_action', { 
      action: 'game_over', 
      payload: { score: finalScore } 
    });
  }

  getState(): GameStateData | null {
    if (!this.room) return null;
    
    return {
      players: this.room.state.players,
      status: this.room.state.status,
      startTime: this.room.state.startTime,
      elapsedTime: this.room.state.elapsedTime,
      winnerId: this.room.state.winnerId
    };
  }

  getPlayers(): Map<string, PlayerData> {
    return this.room?.state.players || new Map();
  }

  getLocalPlayerId(): string | null {
    return this.localPlayerId;
  }

  isHost(): boolean {
    if (!this.room || !this.localPlayerId) return false;
    const players = Array.from(this.room.state.players.values()) as PlayerData[];
    return players.length > 0 && players[0].id === this.localPlayerId;
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      await this.room.leave();
      this.room = null;
    }
    
    if (this.client) {
      this.client = null;
    }

    this.isConnected = false;
    this.localPlayerId = null;
    this.config = null;
  }

  isMultiplayerSession(): boolean {
    return this.isConnected && this.room !== null;
  }
}