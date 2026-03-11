import { create } from 'zustand';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_GAME_API_URL || 'http://localhost:3002';

export type GenerationStatus = 'idle' | 'analyzing' | 'generating' | 'building' | 'complete' | 'error';

export interface GenerationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  progress: number;
}

export interface GeneratedGame {
  id: string;
  title: string;
  description: string;
  type: string;
  code: string;
  thumbnailUrl?: string;
  playUrl?: string;
  createdAt?: string;
}

interface GenerationState {
  // State
  status: GenerationStatus;
  prompt: string;
  gameType: string;
  steps: GenerationStep[];
  generatedGame: GeneratedGame | null;
  error: string | null;
  errorType: 'network' | 'validation' | 'rate_limit' | 'unknown' | null;
  streamingContent: string;

  // Actions
  setPrompt: (prompt: string) => void;
  setGameType: (gameType: string) => void;
  startGeneration: () => Promise<void>;
  updateStep: (stepId: string, updates: Partial<GenerationStep>) => void;
  setStreamingContent: (content: string) => void;
  setComplete: (game: GeneratedGame) => void;
  setError: (error: string, type?: 'network' | 'validation' | 'rate_limit' | 'unknown') => void;
  reset: () => void;
}

const defaultSteps: GenerationStep[] = [
  { id: 'analyzing', title: 'Analyzing your idea', description: 'Understanding game mechanics and theme', status: 'pending', progress: 0 },
  { id: 'generating', title: 'Generating game code', description: 'Writing the game engine and logic', status: 'pending', progress: 0 },
  { id: 'building', title: 'Building game assets', description: 'Creating sprites and visual effects', status: 'pending', progress: 0 },
];

export const useGenerationStore = create<GenerationState>((set, get) => ({
  // Initial state
  status: 'idle',
  prompt: '',
  gameType: 'other',
  steps: defaultSteps,
  generatedGame: null,
  error: null,
  errorType: null,
  streamingContent: '',

  // Actions
  setPrompt: (prompt) => set({ prompt }),
  setGameType: (gameType) => set({ gameType }),

  startGeneration: async () => {
    const prompt = get().prompt;
    const gameType = get().gameType;
    if (!prompt.trim()) return;

    set({
      status: 'analyzing',
      steps: defaultSteps.map((step, index) => ({
        ...step,
        status: index === 0 ? 'in_progress' : 'pending',
        progress: index === 0 ? 0 : 0,
      })),
      generatedGame: null,
      error: null,
      streamingContent: '',
    });

    // Call the game API
    try {
      // Phase 1: Analyzing (complete immediately)
      setTimeout(() => {
        get().updateStep('analyzing', { status: 'complete', progress: 100 });
      }, 1500);

      // Start generating
      setTimeout(() => {
        get().updateStep('generating', { status: 'in_progress', progress: 0 });
      }, 2000);

      const response = await axios.post(`${API_URL}/api/games/generate`, {
        description: prompt,
        type: gameType,
        useAI: true,
      }, {
        timeout: 300000, // 5 minute timeout for complex game generation
      });

      const gameData = response.data;

      // Phase 2: Generating complete
      get().updateStep('generating', { status: 'complete', progress: 100 });

      // Phase 3: Building
      setTimeout(() => {
        get().updateStep('building', { status: 'in_progress', progress: 0 });

        // Simulate building progress
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += 25;
          if (progress >= 100) {
            clearInterval(progressInterval);
            get().updateStep('building', { status: 'complete', progress: 100 });

            // Save game to localStorage
            const gameToSave = {
              id: gameData.id,
              title: gameData.name,
              description: gameData.description,
              type: gameData.type,
              code: gameData.code,
              thumbnailUrl: gameData.thumbnailUrl,
              playUrl: gameData.playUrl,
              createdAt: new Date().toISOString(),
            };

            // Store in localStorage
            try {
              const existingGames = JSON.parse(localStorage.getItem('generated_games') || '[]');
              existingGames.unshift(gameToSave);
              // Keep only last 10 games
              localStorage.setItem('generated_games', JSON.stringify(existingGames.slice(0, 10)));
            } catch (e) {
              console.warn('Failed to save game to localStorage:', e);
            }

            // Set the complete game
            set({
              generatedGame: gameToSave,
              status: 'complete',
            });
          } else {
            get().updateStep('building', { progress });
          }
        }, 300);
      }, 500);

    } catch (error: any) {
      console.error('Game generation error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to generate game';
      const errorType = error.response?.status === 429 ? 'rate_limit' :
                       error.response?.status === 400 ? 'validation' :
                       error.code === 'ECONNABORTED' ? 'network' : 'unknown';
      set({ error: errorMessage, errorType, status: 'error' });
    }
  },

  updateStep: (stepId, updates) => {
    set((state) => {
      const stepIndex = state.steps.findIndex((s) => s.id === stepId);
      if (stepIndex === -1) return state;

      const newSteps = [...state.steps];
      newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates };

      // Update status based on current step
      let status: GenerationStatus = state.status;
      if (updates.status === 'complete') {
        // Move to next step
        const nextIndex = stepIndex + 1;
        if (nextIndex < newSteps.length) {
          newSteps[nextIndex] = { ...newSteps[nextIndex], status: 'in_progress' };
          if (nextIndex === 1) status = 'generating';
          if (nextIndex === 2) status = 'building';
        } else {
          status = 'complete';
        }
      } else if (updates.status === 'in_progress') {
        if (stepId === 'analyzing') status = 'analyzing';
        if (stepId === 'generating') status = 'generating';
        if (stepId === 'building') status = 'building';
      }

      return { steps: newSteps, status };
    });
  },

  setStreamingContent: (content) => set({ streamingContent: content }),

  setComplete: (game) => set({ generatedGame: game, status: 'complete' }),

  setError: (error, type = 'unknown') => set({ error, errorType: type, status: 'error' }),

  reset: () =>
    set({
      status: 'idle',
      prompt: '',
      steps: defaultSteps,
      generatedGame: null,
      error: null,
      errorType: null,
      streamingContent: '',
    }),
}));

// Helper function to get game by ID from localStorage
export function getGameById(id: string): GeneratedGame | null {
  try {
    const games = JSON.parse(localStorage.getItem('generated_games') || '[]');
    return games.find((g: GeneratedGame) => g.id === id) || null;
  } catch {
    return null;
  }
}
