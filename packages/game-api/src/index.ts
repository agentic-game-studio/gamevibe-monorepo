import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { gamesRouter } from './routes/games.js';

const app = express();
const PORT = process.env.PORT || 3002;
const REQUEST_TIMEOUT = 120000; // 2 minute timeout for all requests

// Request timeout middleware
app.use((req, res, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({
        error: 'REQUEST_TIMEOUT',
        message: 'The request took too long to process. Please try again with a simpler game description.'
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
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3003'],
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
