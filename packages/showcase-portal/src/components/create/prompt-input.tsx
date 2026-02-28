'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiZap, FiArrowRight, FiCpu } from 'react-icons/fi';
import { useGenerationStore } from '@/lib/generation-store';

const examplePrompts = [
  { text: 'A space shooter game with power-ups', icon: '🚀' },
  { text: 'Endless runner with obstacles and coins', icon: '🏃' },
  { text: 'Tower defense with different towers', icon: '🏰' },
  { text: 'Puzzle game with match-3 mechanics', icon: '🧩' },
];

export function PromptInput() {
  const { prompt, setPrompt, startGeneration, status } = useGenerationStore();
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isGenerating = status !== 'idle' && status !== 'complete' && status !== 'error';
  const canSubmit = prompt.trim().length > 0 && !isGenerating;

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
      {/* Input Container */}
      <motion.div
        className={`
          relative rounded-2xl border-2 transition-all duration-300 overflow-hidden
          ${focused
            ? 'border-primary-500 shadow-[0_0_40px_-10px_rgba(14,165,233,0.3)]'
            : 'border-[oklch(var(--border))] hover:border-primary-300 dark:hover:border-primary-700'
          }
          bg-[oklch(var(--card))] dark:bg-gray-800/50
        `}
        animate={{ scale: focused ? 1.01 : 1 }}
      >
        {/* Gradient background on focus */}
        {focused && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-secondary-500/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        )}

        <div className="relative p-4">
          {/* Icon */}
          <div className="flex items-start gap-3">
            <div className={`
              flex h-10 w-10 shrink-0 items-center justify-center rounded-xl
              bg-gradient-to-br from-primary-500 to-secondary-500
              text-white shadow-lg
              ${isGenerating ? 'animate-pulse' : ''}
            `}>
              {isGenerating ? (
                <FiCpu className="h-5 w-5 animate-spin" />
              ) : (
                <FiZap className="h-5 w-5" />
              )}
            </div>

            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your game idea... e.g., A space shooter with power-ups and boss battles"
                className="
                  w-full resize-none bg-transparent text-lg
                  placeholder:text-[oklch(var(--muted-foreground))]/50
                  focus:outline-none
                  min-h-[60px] max-h-[200px]
                "
                disabled={isGenerating}
                rows={2}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[oklch(var(--border))]">
            <div className="flex items-center gap-2 text-sm text-[oklch(var(--muted-foreground))]">
              <FiZap className="h-4 w-4" />
              <span>Press Cmd+Enter to generate</span>
            </div>

            <motion.button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium
                transition-all duration-200
                ${canSubmit
                  ? 'bg-gradient-to-r from-primary-600 to-secondary-600 text-white hover:from-primary-700 hover:to-secondary-700 shadow-lg hover:shadow-xl'
                  : 'bg-[oklch(var(--muted))] text-[oklch(var(--muted-foreground))] cursor-not-allowed'
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
                  <FiArrowRight className="h-4 w-4" />
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
          className="mt-6"
        >
          <p className="text-sm text-[oklch(var(--muted-foreground))] mb-3 text-center">
            Try one of these ideas:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {examplePrompts.map((example, index) => (
              <motion.button
                key={index}
                onClick={() => setPrompt(example.text)}
                className="
                  flex items-center gap-2 px-4 py-2 rounded-full
                  bg-[oklch(var(--accent))] text-sm
                  hover:bg-primary-100 dark:hover:bg-primary-900/30
                  transition-colors duration-200
                  text-[oklch(var(--accent-foreground))]
                "
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>{example.icon}</span>
                <span className="font-medium">{example.text}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
