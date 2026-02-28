export class UIManager {
  private container: HTMLElement;
  private overlayElement: HTMLElement | null = null;

  constructor() {
    this.container = document.body;
    this.initializeBaseStyles();
  }

  private initializeBaseStyles(): void {
    // Ensure the body and html have proper styling
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.fontFamily = 'Arial, sans-serif';
    document.body.style.backgroundColor = '#1a1a1a';
    document.body.style.color = '#ffffff';
  }

  showLoading(message: string = 'Loading...'): void {
    this.removeOverlay();

    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'gamevibe-overlay loading';
    this.overlayElement.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div class="loading-text">${message}</div>
      </div>
    `;

    this.container.appendChild(this.overlayElement);
  }

  hideLoading(): void {
    this.removeOverlay();
  }

  showError(message: string, details?: string): void {
    this.removeOverlay();

    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'gamevibe-overlay error';
    this.overlayElement.innerHTML = `
      <div class="error-container">
        <div class="error-icon">❌</div>
        <div class="error-title">Oops! Something went wrong</div>
        <div class="error-message">${message}</div>
        ${details ? `<div class="error-details">${details}</div>` : ''}
        <button class="error-retry-btn" onclick="window.location.reload()">
          Retry
        </button>
      </div>
    `;

    this.container.appendChild(this.overlayElement);
  }

  showGameBrowser(): void {
    this.removeOverlay();

    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'gamevibe-overlay game-browser';
    this.overlayElement.innerHTML = `
      <div class="browser-container">
        <div class="browser-header">
          <h1>🎮 GameVibe</h1>
          <p>Choose a game to play or create a new one</p>
        </div>
        
        <div class="browser-content">
          <div class="browser-section">
            <h3>Recent Games</h3>
            <div class="games-grid" id="recent-games">
              <div class="loading-games">Loading games...</div>
            </div>
          </div>
          
          <div class="browser-section">
            <h3>Popular Games</h3>
            <div class="games-grid" id="popular-games">
              <div class="loading-games">Loading games...</div>
            </div>
          </div>
        </div>
        
        <div class="browser-footer">
          <p>Create games with AI using the Discord bot: <code>/create-game</code></p>
        </div>
      </div>
    `;

    this.container.appendChild(this.overlayElement);
    this.loadGameBrowserData();
  }

  private loadGameBrowserData(): void {
    // This would typically load from the API
    // For now, show placeholder content
    setTimeout(() => {
      const recentGames = document.getElementById('recent-games');
      const popularGames = document.getElementById('popular-games');

      if (recentGames) {
        recentGames.innerHTML = `
          <div class="game-card">
            <div class="game-thumbnail">🎯</div>
            <div class="game-info">
              <div class="game-title">Platformer Adventure</div>
              <div class="game-type">platformer</div>
            </div>
          </div>
          <div class="game-card">
            <div class="game-thumbnail">🧩</div>
            <div class="game-info">
              <div class="game-title">Puzzle Master</div>
              <div class="game-type">puzzle</div>
            </div>
          </div>
        `;
      }

      if (popularGames) {
        popularGames.innerHTML = `
          <div class="game-card">
            <div class="game-thumbnail">🚀</div>
            <div class="game-info">
              <div class="game-title">Space Shooter</div>
              <div class="game-type">shooter</div>
            </div>
          </div>
          <div class="game-card">
            <div class="game-thumbnail">🏃</div>
            <div class="game-info">
              <div class="game-title">Endless Runner</div>
              <div class="game-type">endless-runner</div>
            </div>
          </div>
        `;
      }
    }, 1000);
  }

  showGameOver(score: number): void {
    const gameOverElement = document.createElement('div');
    gameOverElement.className = 'gamevibe-overlay game-over';
    gameOverElement.innerHTML = `
      <div class="game-over-container">
        <div class="game-over-title">🎉 Game Over!</div>
        <div class="game-over-score">
          <div class="score-label">Final Score</div>
          <div class="score-value">${score.toLocaleString()}</div>
        </div>
        <div class="game-over-actions">
          <button class="game-over-btn play-again" onclick="window.location.reload()">
            🎮 Play Again
          </button>
          <button class="game-over-btn new-game" onclick="this.showGameBrowser()">
            🎯 New Game
          </button>
        </div>
        <div class="game-over-sharing">
          <div class="sharing-text">Share your score!</div>
          <button class="share-btn discord" onclick="this.shareScore(${score})">
            📢 Share in Discord
          </button>
        </div>
      </div>
    `;

    // Show game over overlay on top of current game
    this.container.appendChild(gameOverElement);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (gameOverElement.parentNode) {
        gameOverElement.parentNode.removeChild(gameOverElement);
      }
    }, 10000);
  }

  showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const notification = document.createElement('div');
    notification.className = `gamevibe-notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${this.getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
      </div>
    `;

    // Position notifications
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '10000';

    this.container.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  private getNotificationIcon(type: string): string {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  }

  showPlayerList(players: Array<{ username: string; score: number; status: string }>): void {
    let playerListElement = document.getElementById('player-list');
    
    if (!playerListElement) {
      playerListElement = document.createElement('div');
      playerListElement.id = 'player-list';
      playerListElement.className = 'player-list';
      this.container.appendChild(playerListElement);
    }

    playerListElement.innerHTML = `
      <div class="player-list-header">Players (${players.length})</div>
      <div class="player-list-content">
        ${players.map(player => `
          <div class="player-item ${player.status}">
            <span class="player-name">${player.username}</span>
            <span class="player-score">${player.score}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  hidePlayerList(): void {
    const playerListElement = document.getElementById('player-list');
    if (playerListElement) {
      playerListElement.remove();
    }
  }

  private removeOverlay(): void {
    if (this.overlayElement && this.overlayElement.parentNode) {
      this.overlayElement.parentNode.removeChild(this.overlayElement);
      this.overlayElement = null;
    }
  }

  // Utility method for sharing scores (could be expanded)
  private shareScore(score: number): void {
    const message = `I just scored ${score.toLocaleString()} points in GameVibe! 🎮`;
    
    if (navigator.share) {
      navigator.share({
        title: 'GameVibe Score',
        text: message,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(message).then(() => {
        this.showNotification('Score copied to clipboard!', 'success');
      });
    }
  }

  showMultiplayerResults(finalScores: Array<{ playerId: string; username: string; score: number }>): void {
    const resultsElement = document.createElement('div');
    resultsElement.className = 'gamevibe-overlay multiplayer-results';
    resultsElement.innerHTML = `
      <div class="results-container">
        <div class="results-title">🏆 Game Results</div>
        <div class="results-leaderboard">
          ${finalScores.map((player, index) => `
            <div class="result-item rank-${index + 1}">
              <div class="result-rank">${this.getRankEmoji(index + 1)}</div>
              <div class="result-player">
                <div class="player-name">${player.username}</div>
                <div class="player-score">${player.score.toLocaleString()}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="results-actions">
          <button class="action-btn play-again" onclick="window.location.reload()">
            Play Again
          </button>
          <button class="action-btn leave-game" onclick="window.close()">
            Leave Game
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(resultsElement);

    // Auto-remove after 30 seconds
    setTimeout(() => {
      if (resultsElement.parentNode) {
        resultsElement.parentNode.removeChild(resultsElement);
      }
    }, 30000);
  }

  private getRankEmoji(rank: number): string {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  }
}