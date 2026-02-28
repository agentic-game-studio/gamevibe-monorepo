import axios from 'axios';
import jwt from 'jsonwebtoken';
import { injectable } from 'inversify';
import { logger, Game } from '@gamevibe/shared';

const log = logger('MultiplayerService');

export interface MultiplayerOptions {
  maxPlayers?: number;
  gameMode?: 'competitive' | 'cooperative' | 'freeplay';
  isPrivate?: boolean;
}

export interface MultiplayerRoom {
  roomId: string;
  roomCode: string;
  gameId: string;
  gameName: string;
  gameType: string;
  maxPlayers: number;
  currentPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: Date;
}

export interface AuthPayload {
  userId: string;
  username: string;
  avatar?: string;
}

@injectable()
export class MultiplayerService {
  private readonly multiplayerUrl: string;
  private readonly jwtSecret: string;

  constructor() {
    this.multiplayerUrl = process.env.MULTIPLAYER_URL || 'ws://localhost:2567';
    this.jwtSecret = process.env.JWT_SECRET || 'gamevibe-secret-key';
  }

  generateAuthToken(payload: AuthPayload): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '24h' });
  }

  generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createRoom(game: Game, options: MultiplayerOptions = {}): Promise<MultiplayerRoom> {
    try {
      const roomCode = this.generateRoomCode();
      const maxPlayers = options.maxPlayers || 4;

      const response = await axios.post(`${this.multiplayerUrl.replace('ws:', 'http:')}/create-room`, {
        gameId: game.id,
        gameName: game.name,
        gameType: game.type,
        maxPlayers,
        roomCode,
        isPrivate: options.isPrivate || false
      });

      const room: MultiplayerRoom = {
        roomId: response.data.roomId,
        roomCode,
        gameId: game.id,
        gameName: game.name,
        gameType: game.type,
        maxPlayers,
        currentPlayers: 0,
        status: 'waiting',
        createdAt: new Date()
      };

      log.info(`Created multiplayer room ${room.roomId} for game ${game.id}`);
      
      return room;

    } catch (error) {
      log.error('Failed to create multiplayer room:', error);
      throw new Error('Failed to create multiplayer room');
    }
  }

  async getRoomInfo(roomId: string): Promise<MultiplayerRoom | null> {
    try {
      const response = await axios.get(`${this.multiplayerUrl.replace('ws:', 'http:')}/room/${roomId}`);
      return response.data;
    } catch (error) {
      log.error(`Failed to get room info for ${roomId}:`, error);
      return null;
    }
  }

  async getRoomByCode(roomCode: string): Promise<MultiplayerRoom | null> {
    try {
      const response = await axios.get(`${this.multiplayerUrl.replace('ws:', 'http:')}/room-by-code/${roomCode}`);
      return response.data;
    } catch (error) {
      log.error(`Failed to get room by code ${roomCode}:`, error);
      return null;
    }
  }

  async listActiveRooms(gameId?: string): Promise<MultiplayerRoom[]> {
    try {
      const url = gameId 
        ? `${this.multiplayerUrl.replace('ws:', 'http:')}/rooms?gameId=${gameId}`
        : `${this.multiplayerUrl.replace('ws:', 'http:')}/rooms`;
      
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      log.error('Failed to list active rooms:', error);
      return [];
    }
  }

  buildJoinUrl(gameId: string, roomCode: string, token: string): string {
    const baseUrl = process.env.WEB_RUNTIME_URL || 'http://localhost:3001';
    return `${baseUrl}/game/${gameId}?room=${roomCode}&token=${encodeURIComponent(token)}`;
  }

  async closeRoom(roomId: string): Promise<boolean> {
    try {
      await axios.post(`${this.multiplayerUrl.replace('ws:', 'http:')}/room/${roomId}/close`);
      log.info(`Closed multiplayer room ${roomId}`);
      return true;
    } catch (error) {
      log.error(`Failed to close room ${roomId}:`, error);
      return false;
    }
  }
}