'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiZap, FiCpu, FiInfo, FiCheck, FiX, FiActivity } from 'react-icons/fi';
import { useGenerationStore } from '@/lib/generation-store';

const MIN_PROMPT_LENGTH = 10;
const MAX_PROMPT_LENGTH = 500;

const examplePrompts = [
  // Action
  { text: 'A space shooter game with power-ups and boss battles', icon: '🚀', category: 'action' },
  { text: 'Fast-paced beat em up with combos', icon: '👊', category: 'action' },
  { text: 'Platformer with wall jumping and double jump', icon: '🎮', category: 'action' },
  // Puzzle
  { text: 'Puzzle game with match-3 mechanics', icon: '🧩', category: 'puzzle' },
  { text: 'Sudoku puzzle game with hints', icon: '🔢', category: 'puzzle' },
  { text: 'Word search puzzle game', icon: '📝', category: 'puzzle' },
  // Strategy
  { text: 'Tower defense with different towers', icon: '🏰', category: 'strategy' },
  { text: 'Turn-based strategy game', icon: '♟️', category: 'strategy' },
  { text: 'Card battle game with deck building', icon: '🃏', category: 'strategy' },
  // Adventure
  { text: 'Top-down dungeon crawler with loot', icon: '🗡️', category: 'adventure' },
  { text: 'Point and click adventure', icon: '🔍', category: 'adventure' },
  { text: 'Endless runner with obstacles and coins', icon: '🏃', category: 'adventure' },
];

export function PromptInput() {
  const { prompt, setPrompt, startGeneration, status } = useGenerationStore();
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isGenerating = status !== 'idle' && status !== 'complete' && status !== 'error';
  const promptLength = prompt.length;
  const isTooShort = promptLength > 0 && promptLength < MIN_PROMPT_LENGTH;
  const isTooLong = promptLength > MAX_PROMPT_LENGTH;
  const isValid = promptLength >= MIN_PROMPT_LENGTH && promptLength <= MAX_PROMPT_LENGTH;
  const canSubmit = isValid && !isGenerating;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  const handleSubmit = () => {
    if (canSubmit) {
      startGeneration();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Input Container - Premium Design */}
      <motion.div
        className={`
          relative rounded-2xl border transition-all duration-300 overflow-hidden
          ${focused
            ? 'border-primary-500/50 shadow-[0_0_60px_-15px_rgba(14,165,233,0.25)] bg-zinc-900/80'
            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40'
          }
        `}
        animate={{ scale: focused ? 1.005 : 1 }}
      >
        {/* Glow effect on focus */}
        {focused && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-secondary-500/5 pointer-events-none" />
        )}

        <div className="relative p-5">
          {/* Icon & Input Row */}
          <div className="flex items-start gap-4">
            {/* Icon */}
            <motion.div
              className={`
                flex h-12 w-12 shrink-0 items-center justify-center rounded-xl
                bg-gradient-to-br from-primary-500 to-secondary-500
                text-white shadow-lg shadow-primary-500/20
                ${isGenerating ? 'animate-pulse' : ''}
              `}
              whileHover={{ scale: 1.05 }}
            >
              {isGenerating ? (
                <FiCpu className="h-6 w-6 animate-spin" />
              ) : (
                <FiActivity className="h-6 w-6" />
              )}
            </motion.div>

            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your game idea... e.g., A space shooter with power-ups, boss battles, and scoring"
                className="
                  w-full resize-none bg-transparent text-lg text-white placeholder:text-zinc-600
                  focus:outline-none min-h-[60px] max-h-[200px]
                "
                disabled={isGenerating}
                rows={2}
              />
            </div>
          </div>

          {/* Character Count & Validation */}
          {(focused || promptLength > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800"
            >
              <div className="flex items-center gap-3">
                <span className={`
                  text-xs font-medium px-2.5 py-1 rounded-full
                  ${isValid
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : isTooShort
                      ? 'bg-yellow-500/15 text-yellow-400'
                      : 'bg-red-500/15 text-red-400'
                  }
                `}>
                  {promptLength}/{MAX_PROMPT_LENGTH}
                </span>
                {isValid ? (
                  <FiCheck className="h-4 w-4 text-emerald-400" />
                ) : isTooShort ? (
                  <span className="text-xs text-yellow-400">Min {MIN_PROMPT_LENGTH} chars</span>
                ) : (
                  <FiX className="h-4 w-4 text-red-400" />
                )}
              </div>

              {isTooShort && (
                <p className="text-xs text-yellow-400/80">Add more details for better results</p>
              )}
              {isTooLong && (
                <p className="text-xs text-red-400/80">Prompt is too long</p>
              )}
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <FiZap className="h-4 w-4" />
              <span>Press Cmd+Enter to generate</span>
            </div>

            <motion.button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`
                flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-medium
                transition-all duration-200
                ${canSubmit
                  ? 'bg-gradient-to-r from-primary-600 to-secondary-600 text-white hover:shadow-lg hover:shadow-primary-500/25 hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }
              `}
              whileHover={canSubmit ? { scale: 1.02 } : {}}
              whileTap={canSubmit ? { scale: 0.98 } : {}}
            >
              {isGenerating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Game
                  <FiZap className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Example Prompts */}
      {!focused && !prompt && status === 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <p className="text-sm text-zinc-500 mb-4 text-center">
            Or choose a game type to get started:
          </p>

          {/* Categories */}
          {['action', 'puzzle', 'strategy', 'adventure'].map((category) => (
            <div key={category} className="mb-4">
              <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider mb-2 ml-1">
                {category}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {examplePrompts.filter(p => p.category === category).map((example, index) => (
                  <motion.button
                    key={index}
                    onClick={() => setPrompt(example.text)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                      bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80
                      text-zinc-300 transition-all duration-200
                    `}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + index * 0.03 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <span>{example.icon}</span>
                    <span className="font-medium">{example.text}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          ))}

          {/* Tips */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-6 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
                <FiInfo className="h-4 w-4 text-primary-400" />
              </div>
              <div>
                <h4 className="font-medium text-sm text-zinc-300 mb-1">Tips for better games</h4>
                <ul className="text-xs text-zinc-500 space-y-1">
                  <li>• Be specific about mechanics (power-ups, bosses, levels)</li>
                  <li>• Mention the theme (space, fantasy, sci-fi)</li>
                  <li>• Include difficulty if desired</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
