import { create } from 'zustand';

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
}

interface GenerationState {
  // State
  status: GenerationStatus;
  prompt: string;
  steps: GenerationStep[];
  generatedGame: GeneratedGame | null;
  error: string | null;
  streamingContent: string;

  // Actions
  setPrompt: (prompt: string) => void;
  startGeneration: () => void;
  updateStep: (stepId: string, updates: Partial<GenerationStep>) => void;
  setStreamingContent: (content: string) => void;
  setComplete: (game: GeneratedGame) => void;
  setError: (error: string) => void;
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
  steps: defaultSteps,
  generatedGame: null,
  error: null,
  streamingContent: '',

  // Actions
  setPrompt: (prompt) => set({ prompt }),

  startGeneration: () => {
    const prompt = get().prompt;
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

  setError: (error) => set({ error, status: 'error' }),

  reset: () =>
    set({
      status: 'idle',
      prompt: '',
      steps: defaultSteps,
      generatedGame: null,
      error: null,
      streamingContent: '',
    }),
}));
