import 'dotenv/config';
console.log('MINIMAX_API_KEY:', process.env.MINIMAX_API_KEY ? 'SET' : 'NOT SET');
import express from 'express';
import cors from 'cors';
import { gamesRouter } from './routes/games.js';

const app = express();
const PORT = process.env.PORT || 3002;
const REQUEST_TIMEOUT = 360000; // 6 minute timeout (longer than frontend's 5 min)

// Request timeout middleware
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        error: 'GENERATION_TIMEOUT',
        message: 'The game generation took too long. Please try a simpler game description like "simple platformer game" or "basic shooter".'
      });
    }
  }, REQUEST_TIMEOUT);

  res.on('finish', () => {
    clearTimeout(timeout);
  });

  next();
});

// CORS - allow requests from the frontend
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3003', 'http://localhost:3010'],
  credentials: true,
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Game routes
app.use('/api/games', gamesRouter);

app.listen(PORT, () => {
  console.log(`[GameAPI] Server running on port ${PORT}`);
});

export default app;
