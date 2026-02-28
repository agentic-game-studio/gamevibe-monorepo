import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { logger } from '@gamevibe/shared';
import { authMiddleware } from './auth/middleware.js';
import { GameRoom } from './rooms/GameRoom.js';

const log = logger('MultiplayerServer');

const app = express();
const port = parseInt(process.env.MULTIPLAYER_PORT || '2567', 10);

app.use(cors({
  origin: [
    process.env.WEB_RUNTIME_URL || 'http://localhost:3001',
    'https://discord.com',
    'https://discordapp.com'
  ],
  credentials: true
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'multiplayer-server' });
});

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: createServer(app)
  })
});

gameServer.define('game_room', GameRoom)
  .filterBy(['gameId']);

gameServer.onShutdown(() => {
  log.info('Multiplayer server is shutting down...');
});

gameServer.listen(port);

log.info(`Multiplayer server listening on ws://localhost:${port}`);