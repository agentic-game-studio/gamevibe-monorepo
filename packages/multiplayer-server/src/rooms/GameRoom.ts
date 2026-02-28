import { Room, Client } from '@colyseus/core';
import { logger } from '@gamevibe/shared';
import { GameState, Player } from '../schema/GameState.js';
import { authMiddleware, AuthPayload } from '../auth/middleware.js';

const log = logger('GameRoom');

export interface GameRoomOptions {
  gameId: string;
  gameName: string;
  gameType: string;
  maxPlayers?: number;
}

export interface JoinOptions {
  token: string;
}

export class GameRoom extends Room<GameState> {
  maxClients = 4;
  autoDispose = true;

  async onCreate(options: GameRoomOptions) {
    log.info(`Creating game room for ${options.gameId}`);
    
    this.setState(new GameState(
      options.gameId,
      options.gameName,
      options.gameType
    ));

    if (options.maxPlayers) {
      this.maxClients = options.maxPlayers;
      this.state.maxPlayers = options.maxPlayers;
    }

    this.setMetadata({
      gameId: options.gameId,
      gameName: options.gameName,
      gameType: options.gameType
    });

    this.setupMessageHandlers();
    this.setupGameLoop();
  }

  async onAuth(client: Client, options: JoinOptions): Promise<AuthPayload | false> {
    const auth = await authMiddleware(options.token);
    return auth || false;
  }

  onJoin(client: Client, options: JoinOptions, auth: AuthPayload) {
    log.info(`Player ${auth.username} joined room ${this.roomId}`);

    const player = new Player(auth.userId, auth.username, auth.avatar);
    this.state.addPlayer(player);

    client.send('joined', {
      playerId: auth.userId,
      roomId: this.roomId,
      gameState: this.state.toJSON()
    });

    if (this.state.players.size >= 2 && this.state.status === 'waiting') {
      this.broadcast('ready_check', { message: 'Enough players to start!' });
    }
  }

  onLeave(client: Client, consented: boolean) {
    const player = Array.from(this.state.players.values())
      .find(p => p.id === (client as any).auth?.userId);

    if (player) {
      log.info(`Player ${player.username} left room ${this.roomId}`);
      this.state.removePlayer(player.id);

      if (this.state.status === 'playing' && this.state.players.size < 2) {
        this.endGame();
      }
    }
  }

  private setupMessageHandlers() {
    this.onMessage('player_ready', (client, data) => {
      const player = this.state.getPlayer((client as any).auth.userId);
      if (player) {
        player.isReady = true;
        this.checkAllPlayersReady();
      }
    });

    this.onMessage('player_move', (client, data: { x: number; y: number }) => {
      const player = this.state.getPlayer((client as any).auth.userId);
      if (player && this.state.status === 'playing') {
        player.x = data.x;
        player.y = data.y;
      }
    });

    this.onMessage('player_action', (client, data: { action: string; payload?: any }) => {
      const player = this.state.getPlayer((client as any).auth.userId);
      if (player && this.state.status === 'playing') {
        this.handlePlayerAction(client, player, data.action, data.payload);
      }
    });

    this.onMessage('update_score', (client, data: { score: number }) => {
      const player = this.state.getPlayer((client as any).auth.userId);
      if (player && this.state.status === 'playing') {
        player.score = data.score;
        this.broadcast('score_updated', {
          playerId: player.id,
          score: player.score
        });
      }
    });
  }

  private setupGameLoop() {
    this.setSimulationInterval((deltaTime) => {
      if (this.state.status === 'playing') {
        this.state.updateElapsedTime();
      }
    }, 100);
  }

  private checkAllPlayersReady() {
    const allReady = Array.from(this.state.players.values())
      .every(player => player.isReady);

    if (allReady && this.state.players.size >= 2) {
      this.startGame();
    }
  }

  private startGame() {
    log.info(`Starting game in room ${this.roomId}`);
    this.state.startGame();
    this.broadcast('game_started', {
      startTime: this.state.startTime
    });
  }

  private endGame(winnerId?: string) {
    log.info(`Ending game in room ${this.roomId}`);
    this.state.endGame(winnerId);
    
    const scores = Array.from(this.state.players.values())
      .map(p => ({ playerId: p.id, username: p.username, score: p.score }))
      .sort((a, b) => b.score - a.score);

    this.broadcast('game_ended', {
      winnerId: winnerId || scores[0]?.playerId,
      finalScores: scores,
      duration: this.state.elapsedTime
    });

    setTimeout(() => {
      this.disconnect();
    }, 10000);
  }

  private handlePlayerAction(client: Client, player: Player, action: string, payload: any) {
    switch (action) {
      case 'shoot':
      case 'jump':
      case 'collect':
        this.broadcast('player_action', {
          playerId: player.id,
          action,
          payload
        }, { except: [client] });
        break;
      
      case 'game_over':
        if (payload.score !== undefined) {
          player.score = payload.score;
        }
        this.endGame();
        break;
    }
  }

  onDispose() {
    log.info(`Disposing room ${this.roomId}`);
  }
}