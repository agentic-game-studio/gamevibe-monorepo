import './style.css';
import { GameLoader } from './game/loader.js';
import { UIManager } from './ui/manager.js';
import { APIClient } from './api/client.js';

// Standalone runtime for GameVibe AI (works in browser without Discord)
class GameVibeStandaloneRuntime {
  private gameLoader: GameLoader;
  private uiManager: UIManager;
  private apiClient: APIClient;

  constructor() {
    // Use environment variable or fallback to 127.0.0.1 (more reliable on macOS)
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8081';
    console.log(`🔗 Using API base URL: ${apiBaseUrl}`);
    this.apiClient = new APIClient(apiBaseUrl);
    this.gameLoader = new GameLoader(this.apiClient);
    this.uiManager = new UIManager();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🎮 Initializing GameVibe Standalone Runtime...');
      
      // Show loading screen
      this.uiManager.showLoading('Loading game...');

      // Skip Discord authentication for standalone mode
      console.log('🌐 Running in standalone browser mode');

      // Load game if specified in URL
      await this.loadGameFromURL();

      // Setup event listeners
      this.setupEventListeners();

      console.log('✅ GameVibe Standalone Runtime initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize GameVibe Runtime:', error);
      this.uiManager.showError('Failed to initialize game runtime: ' + (error as Error).message);
    }
  }

  private async loadGameFromURL(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('game_id') || urlParams.get('g');
    
    if (gameId) {
      console.log(`🎯 Loading game: ${gameId}`);
      await this.loadGame(gameId);
    } else {
      this.uiManager.hideLoading();
      this.uiManager.showError('No game ID provided');
      await this.showAvailableGames();
    }
  }

  async loadGame(gameId: string): Promise<void> {
    try {
      console.log(`🚀 Starting game load process for ID: ${gameId}`);
      this.uiManager.showLoading('Loading game data...');
      
      // Fetch game data from API
      console.log(`📥 Fetching game data for ID: ${gameId} from API...`);
      const gameData = await this.apiClient.getGame(gameId);
      
      console.log(`✅ Game data loaded successfully: ${gameData.name}`);
      console.log('📊 Complete game data:', {
        id: gameData.id,
        shortId: gameData.shortId,
        name: gameData.name,
        type: gameData.type,
        codeLength: gameData.code?.length || 0,
        hasCode: !!gameData.code,
        hasAssets: !!gameData.assets,
        assetsCount: gameData.assets ? Object.keys(gameData.assets).length : 0,
        codePreview: gameData.code?.substring(0, 200) || 'NO CODE',
        assets: gameData.assets
      });
      
      // Test if game container exists
      const gameContainer = document.getElementById('game-container');
      console.log('🎯 Game container:', gameContainer ? 'Found' : 'NOT FOUND');
      
      // Load and start the game
      console.log('🎮 Starting game loader...');
      this.uiManager.showLoading('Initializing game engine...');
      
      await this.gameLoader.loadGame(gameData);
      
      console.log('✅ Game loader completed successfully');
      this.uiManager.hideLoading();
      console.log(`🎉 Game started successfully: ${gameData.name}`);
      
      // Add a small delay then check if anything rendered
      setTimeout(() => {
        const canvas = document.querySelector('canvas');
        const gameDiv = document.querySelector('#game-container > div');
        console.log('🔍 Post-load check:', {
          canvasFound: !!canvas,
          canvasSize: canvas ? `${canvas.width}x${canvas.height}` : 'none',
          gameDivFound: !!gameDiv,
          containerChildren: gameContainer?.children.length || 0
        });
      }, 2000);
      
    } catch (error) {
      console.error('❌ Failed to load game:', error);
      console.error('📋 Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack?.substring(0, 500)
      });
      
      const errorMessage = (error as Error).message;
      
      if (errorMessage.includes('404')) {
        // Game not found - show available games
        this.uiManager.showError(`Game not found (ID: ${gameId})`);
        await this.showAvailableGames();
      } else {
        this.uiManager.showError(`Failed to load game: ${errorMessage}`);
      }
    }
  }

  private setupEventListeners(): void {
    // Handle game events
    this.gameLoader.on('gameEnd', (score: number) => {
      this.handleGameEnd(score);
    });

    this.gameLoader.on('scoreUpdate', (score: number) => {
      console.log('Score updated:', score);
      // In standalone mode, just log the score
    });

    // Handle errors
    this.gameLoader.on('error', (error: Error) => {
      console.error('Game error:', error);
      this.uiManager.showError(`Game error: ${error.message}`);
    });
  }

  private async handleGameEnd(score: number): Promise<void> {
    console.log('🏁 Game ended with score:', score);
    
    // Show game over screen
    this.uiManager.showNotification(`Game Over! Score: ${score}`);
    
    // In standalone mode, we can't submit scores without authentication
    console.log('Note: Score submission not available in standalone mode');
  }

  private async showAvailableGames(): Promise<void> {
    try {
      console.log('📋 Fetching available games...');
      const games = await this.apiClient.getRecentGames(20);
      
      // Create a simple game list UI
      const gameListHTML = `
        <div style="
          max-width: 600px;
          margin: 2rem auto;
          padding: 2rem;
          background: rgba(0,0,0,0.8);
          border-radius: 1rem;
          color: white;
          font-family: Arial, sans-serif;
        ">
          <h2 style="margin-bottom: 1.5rem;">🎮 Available Games</h2>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${games.map(game => `
              <a href="?game_id=${game.shortId}" style="
                display: block;
                padding: 1rem;
                background: rgba(255,255,255,0.1);
                border-radius: 0.5rem;
                text-decoration: none;
                color: white;
                transition: background 0.2s;
              " onmouseover="this.style.background='rgba(255,255,255,0.2)'" 
                 onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                <div style="font-weight: bold; margin-bottom: 0.5rem;">
                  ${game.name}
                </div>
                <div style="font-size: 0.9rem; opacity: 0.8;">
                  Type: ${game.type} | ID: ${game.shortId}
                </div>
              </a>
            `).join('')}
          </div>
          <div style="margin-top: 2rem; text-align: center; opacity: 0.7;">
            Click on any game to play!
          </div>
        </div>
      `;
      
      // Replace the game container content
      const gameContainer = document.getElementById('game-container');
      if (gameContainer) {
        gameContainer.innerHTML = gameListHTML;
      }
      
    } catch (error) {
      console.error('Failed to fetch available games:', error);
      this.uiManager.showError('Failed to load game list');
    }
  }
}

// Initialize runtime when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    const runtime = new GameVibeStandaloneRuntime();
    await runtime.initialize();
  });
} else {
  const runtime = new GameVibeStandaloneRuntime();
  runtime.initialize();
}