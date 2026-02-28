import { Schema, MapSchema, type } from '@colyseus/schema';

export class Player extends Schema {
  @type('string') id: string;
  @type('string') username: string;
  @type('string') avatar: string;
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') score: number = 0;
  @type('boolean') isReady: boolean = false;
  @type('string') state: string = 'idle';

  constructor(id: string, username: string, avatar?: string) {
    super();
    this.id = id;
    this.username = username;
    this.avatar = avatar || '';
  }
}

export class GameState extends Schema {
  @type('string') gameId: string;
  @type('string') gameName: string;
  @type('string') gameType: string;
  @type('string') status: 'waiting' | 'playing' | 'finished' = 'waiting';
  @type('number') startTime: number = 0;
  @type('number') elapsedTime: number = 0;
  @type({ map: Player }) players = new MapSchema<Player>();
  @type('string') winnerId: string = '';
  @type('number') maxPlayers: number = 4;

  constructor(gameId: string, gameName: string, gameType: string) {
    super();
    this.gameId = gameId;
    this.gameName = gameName;
    this.gameType = gameType;
  }

  addPlayer(player: Player): void {
    this.players.set(player.id, player);
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  startGame(): void {
    this.status = 'playing';
    this.startTime = Date.now();
  }

  endGame(winnerId?: string): void {
    this.status = 'finished';
    this.winnerId = winnerId || '';
  }

  updateElapsedTime(): void {
    if (this.status === 'playing' && this.startTime > 0) {
      this.elapsedTime = Date.now() - this.startTime;
    }
  }
}