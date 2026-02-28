import './style.css';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { GameLoader } from './game/loader.js';
import { SessionManager } from './session/manager.js';
import { MultiplayerManager } from './multiplayer/manager.js';
import { UIManager } from './ui/manager.js';
import { APIClient } from './api/client.js';

// Discord Activities runtime for GameVibe AI
class GameVibeRuntime {
  private discordSdk: DiscordSDK;
  private gameLoader: GameLoader;
  private sessionManager: SessionManager;
  private multiplayerManager: MultiplayerManager;
  private uiManager: UIManager;
  private apiClient: APIClient;
  private authenticated = false;

  constructor() {
    this.discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
    this.apiClient = new APIClient(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000');
    this.gameLoader = new GameLoader(this.apiClient);
    this.sessionManager = new SessionManager(this.discordSdk, this.apiClient);
    this.multiplayerManager = new MultiplayerManager();
    this.uiManager = new UIManager();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🎮 Initializing GameVibe Runtime...');
      
      // Show loading screen
      this.uiManager.showLoading('Connecting to Discord...');

      // Setup Discord SDK
      await this.setupDiscordSDK();

      // Authenticate user
      await this.authenticateUser();

      // Initialize session manager
      await this.sessionManager.initialize();

      // Load game if specified in URL
      await this.loadGameFromURL();

      // Setup event listeners
      this.setupEventListeners();

      this.uiManager.hideLoading();
      console.log('✅ GameVibe Runtime initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize GameVibe Runtime:', error);
      this.uiManager.showError('Failed to initialize game runtime');
    }
  }

  private async setupDiscordSDK(): Promise<void> {
    await this.discordSdk.ready();
  }

  private async authenticateUser(): Promise<void> {
    const { code } = await this.discordSdk.commands.authorize({
      client_id: this.discordSdk.clientId,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify', 'guilds']
    });

    // Exchange code for access token via our API
    const response = await this.apiClient.exchangeCode(code);
    this.apiClient.setAccessToken(response.access_token);
    this.apiClient.setCurrentUser(response.user);
    this.authenticated = true;

    console.log('✅ User authenticated:', response.user.username);
  }

  private async loadGameFromURL(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('game_id') || urlParams.get('g');
    const roomCode = urlParams.get('room');
    const token = urlParams.get('token');
    
    if (gameId) {
      console.log(`🎯 Loading game: ${gameId}`);
      
      // Check if this is a multiplayer session
      if (roomCode && token) {
        console.log(`🎮 Joining multiplayer room: ${roomCode}`);
        await this.loadMultiplayerGame(gameId, roomCode, token);
      } else {
        await this.loadGame(gameId);
      }
    } else {
      this.uiManager.showGameBrowser();
    }
  }

  async loadGame(gameId: string): Promise<void> {
    try {
      this.uiManager.showLoading('Loading game...');
      
      // Fetch game data
      const gameData = await this.apiClient.getGame(gameId);
      
      // Load and start the game
      await this.gameLoader.loadGame(gameData);
      
      // Join or create session
      await this.sessionManager.joinGame(gameId);
      
      this.uiManager.hideLoading();
      console.log(`✅ Game loaded: ${gameData.name}`);
      
    } catch (error) {
      console.error('❌ Failed to load game:', error);
      this.uiManager.showError('Failed to load game');
    }
  }

  async loadMultiplayerGame(gameId: string, roomCode: string, token: string): Promise<void> {
    try {
      this.uiManager.showLoading('Joining multiplayer game...');
      
      // Fetch game data
      const gameData = await this.apiClient.getGame(gameId);
      
      // Connect to multiplayer server
      const multiplayerUrl = import.meta.env.VITE_MULTIPLAYER_URL || 'ws://localhost:2567';
      await this.multiplayerManager.connect({
        url: multiplayerUrl,
        roomCode,
        token,
        gameId
      });
      
      // Load game with multiplayer support
      await this.gameLoader.loadGame(gameData, this.multiplayerManager);
      
      // Setup multiplayer event handlers
      this.setupMultiplayerEventListeners();
      
      this.uiManager.hideLoading();
      console.log(`✅ Multiplayer game loaded: ${gameData.name}`);
      
    } catch (error) {
      console.error('❌ Failed to join multiplayer game:', error);
      this.uiManager.showError('Failed to join multiplayer game');
    }
  }

  private setupEventListeners(): void {
    // Handle Discord SDK events
    this.discordSdk.subscribe('ACTIVITY_LAYOUT_MODE_UPDATE', (event) => {
      this.gameLoader.handleLayoutChange(String(event.layout_mode));
    });

    this.discordSdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', (event) => {
      this.sessionManager.handleParticipantsUpdate(event.participants);
    });

    // Handle session events
    this.sessionManager.on('playerJoined', (player: any) => {
      this.uiManager.showNotification(`${player.username} joined the game`);
    });

    this.sessionManager.on('playerLeft', (player: any) => {
      this.uiManager.showNotification(`${player.username} left the game`);
    });

    this.sessionManager.on('gameStateUpdate', (state: any) => {
      this.gameLoader.updateGameState(state);
    });

    // Handle game events
    this.gameLoader.on('gameEnd', (score: number) => {
      this.handleGameEnd(score);
    });

    this.gameLoader.on('scoreUpdate', (score: number) => {
      this.sessionManager.updateScore(score);
    });

    // Handle window events
    window.addEventListener('beforeunload', () => {
      this.sessionManager.leaveSession();
    });
  }

  private setupMultiplayerEventListeners(): void {
    // Handle multiplayer events
    this.multiplayerManager.on('connected', (data: any) => {
      console.log('Connected to multiplayer room:', data);
      this.uiManager.showNotification('Connected to multiplayer game');
    });

    this.multiplayerManager.on('playerJoined', ({ player }: { player: any }) => {
      this.uiManager.showNotification(`${player.username} joined the game`);
      this.gameLoader.handlePlayerJoined(player);
    });

    this.multiplayerManager.on('playerLeft', ({ player }: { player: any }) => {
      this.uiManager.showNotification(`${player.username} left the game`);
      this.gameLoader.handlePlayerLeft(player);
    });

    this.multiplayerManager.on('playerUpdated', ({ playerId, player }: { playerId: string; player: any }) => {
      this.gameLoader.handlePlayerUpdate(playerId, player);
    });

    this.multiplayerManager.on('gameStarted', (data: any) => {
      console.log('Multiplayer game started:', data);
      this.gameLoader.startGame();
    });

    this.multiplayerManager.on('gameEnded', (data: any) => {
      console.log('Multiplayer game ended:', data);
      this.handleMultiplayerGameEnd(data);
    });

    this.multiplayerManager.on('scoreUpdated', ({ playerId, score }: { playerId: string; score: number }) => {
      this.gameLoader.updatePlayerScore(playerId, score);
    });

    this.multiplayerManager.on('playerAction', (data: any) => {
      this.gameLoader.handleRemotePlayerAction(data);
    });

    // Handle disconnection
    this.multiplayerManager.on('disconnected', () => {
      this.uiManager.showNotification('Disconnected from multiplayer game');
    });

    // Handle errors
    this.multiplayerManager.on('error', (error: any) => {
      console.error('Multiplayer error:', error);
      this.uiManager.showError('Multiplayer connection error');
    });
  }

  private async handleGameEnd(score: number): Promise<void> {
    try {
      // Submit score to leaderboard
      await this.apiClient.submitScore(this.sessionManager.currentGameId!, score);
      
      // Show game over screen
      this.uiManager.showGameOver(score);
      
      // Update Discord activity
      await this.discordSdk.commands.setActivity({
        activity: {
          details: 'Game completed',
          state: `Score: ${score}`,
          timestamps: {
            end: Date.now()
          }
        }
      });
      
    } catch (error) {
      console.error('Failed to handle game end:', error);
    }
  }

  private async handleMultiplayerGameEnd(data: any): Promise<void> {
    try {
      // Show multiplayer game results
      this.uiManager.showMultiplayerResults(data.finalScores);
      
      // Update Discord activity
      await this.discordSdk.commands.setActivity({
        activity: {
          details: 'Multiplayer game completed',
          state: `Ranked #${data.finalScores.findIndex((s: any) => s.playerId === this.multiplayerManager.getLocalPlayerId()) + 1}`,
          timestamps: {
            end: Date.now()
          }
        }
      });
      
      // Disconnect from multiplayer
      setTimeout(() => {
        this.multiplayerManager.disconnect();
      }, 10000);
      
    } catch (error) {
      console.error('Failed to handle multiplayer game end:', error);
    }
  }

  // Public API for games to interact with runtime
  getDiscordSDK(): DiscordSDK {
    return this.discordSdk;
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  getAPIClient(): APIClient {
    return this.apiClient;
  }

  getMultiplayerManager(): MultiplayerManager {
    return this.multiplayerManager;
  }
}

// Global runtime instance
const runtime = new GameVibeRuntime();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => runtime.initialize());
} else {
  runtime.initialize();
}

// Expose runtime globally for games to access
(window as any).GameVibeRuntime = runtime;

export { GameVibeRuntime };