'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiZap, FiCpu, FiInfo, FiCheck, FiX, FiActivity, FiImage, FiUpload, FiArrowRight } from 'react-icons/fi';
import Link from 'next/link';
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
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isGenerating = status !== 'idle' && status !== 'complete' && status !== 'error';

  // Sub-style options for each template
  const templateStyles: Record<string, { name: string; desc: string }[]> = {
    Platformer: [
      { name: 'Classic', desc: 'Traditional side-scrolling platformer' },
      { name: 'Precision', desc: 'Tight controls, challenging levels' },
      { name: 'Roguelike', desc: 'Procedurally generated stages' },
    ],
    Shooter: [
      { name: 'Space', desc: 'Asteroids, invaders style' },
      { name: 'Top-Down', desc: 'Twin-stick shooter action' },
      { name: 'First-Person', desc: 'Immersive FPS experience' },
    ],
    Puzzle: [
      { name: 'Match-3', desc: 'Classic gem matching' },
      { name: 'Physics', desc: 'Gravity-based puzzles' },
      { name: 'Escape', desc: 'Solve to escape' },
    ],
    RPG: [
      { name: 'Turn-Based', desc: 'Classic JRPG combat' },
      { name: 'Action', desc: 'Real-time battles' },
      { name: 'Roguelike', desc: 'Permadeath adventure' },
    ],
    Racing: [
      { name: 'Arcade', desc: 'Fun, pick-up-and-play' },
      { name: 'Simulation', desc: 'Realistic physics' },
      { name: 'Stunt', desc: 'Tricks and stunts' },
    ],
    'Tower Defense': [
      { name: 'Classic', desc: 'Build and defend' },
      { name: 'Maze', desc: 'Guide enemies through' },
      { name: 'TD/MOBA', desc: 'MOBA-style lanes' },
    ],
    Adventure: [
      { name: 'Metroidvania', desc: 'Exploration focus' },
      { name: 'Point & Click', desc: 'Puzzle-driven' },
      { name: 'Dungeon Crawler', desc: 'Fight through dungeons' },
    ],
    Fighting: [
      { name: '2D Fighter', desc: 'Classic beat em up' },
      { name: '3D Fighter', desc: 'Arena combat' },
      { name: 'Arena', desc: 'Free-for-all brawls' },
    ],
  };

  const handleTemplateClick = (templateName: string) => {
    if (selectedTemplate === templateName) {
      setSelectedTemplate(null);
    } else {
      setSelectedTemplate(templateName);
    }
  };

  const handleStyleSelect = (templateName: string, styleName: string) => {
    setPrompt(`Create a ${styleName} ${templateName} game`);
    setSelectedTemplate(null);
  };
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
    <div className="w-full max-w-4xl mx-auto">
      {/* Just tell your Game Developer */}
      <div className="text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-bold">
          <span className="gold-accent">Just tell your</span> Game Developer
        </h2>
        <p className="text-[#a89585] mt-2">Describe your vision and watch it come to life</p>
      </div>

      {/* Input Container - Theme Design - Larger */}
      <motion.div
        className={`
          relative rounded-2xl border-2 transition-all duration-300 overflow-hidden
          ${focused
            ? 'border-[#ffd700]/50 shadow-[0_0_60px_-15px_rgba(255,107,53,0.25)] bg-[#1a1425]/80'
            : 'border-[#5c4410] hover:border-[#ffd700]/50 bg-[#1a1425]/40'
          }
        `}
        animate={{ scale: focused ? 1.005 : 1 }}
      >
        {/* Glow effect on focus */}
        {focused && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#ff6b35]/5 via-transparent to-[#ffd700]/5 pointer-events-none" />
        )}

        <div className="relative p-6">
          {/* Icon & Input Row */}
          <div className="flex items-start gap-4">
            {/* Icon */}
            <motion.div
              className={`
                flex h-14 w-14 shrink-0 items-center justify-center rounded-xl
                bg-gradient-to-br from-[#ff6b35] to-[#f7c548]
                text-white shadow-lg shadow-[#ff6b35]/20
                ${isGenerating ? 'animate-pulse' : ''}
              `}
              whileHover={{ scale: 1.05 }}
            >
              {isGenerating ? (
                <FiCpu className="h-7 w-7 animate-spin" />
              ) : (
                <FiActivity className="h-7 w-7" />
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
                  w-full resize-none bg-transparent text-xl text-white placeholder:text-[#a89585]
                  focus:outline-none min-h-[100px] max-h-[300px]
                "
                disabled={isGenerating}
                rows={4}
              />
            </div>
          </div>

          {/* Character Count & Validation */}
          {(focused || promptLength > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center justify-between mt-4 pt-4 border-t border-[#5c4410]"
            >
              <div className="flex items-center gap-3">
                <span className={`
                  text-xs font-medium px-2.5 py-1 rounded-full
                  ${isValid
                    ? 'bg-[#10b981]/15 text-[#10b981]'
                    : isTooShort
                      ? 'bg-[#fbbf24]/15 text-[#fbbf24]'
                      : 'bg-red-500/15 text-red-400'
                  }
                `}>
                  {promptLength}/{MAX_PROMPT_LENGTH}
                </span>
                {isValid ? (
                  <FiCheck className="h-4 w-4 text-[#10b981]" />
                ) : isTooShort ? (
                  <span className="text-xs text-[#fbbf24]">Min {MIN_PROMPT_LENGTH} chars</span>
                ) : (
                  <FiX className="h-4 w-4 text-red-400" />
                )}
              </div>

              {isTooShort && (
                <p className="text-xs text-[#fbbf24]/80">Add more details for better results</p>
              )}
              {isTooLong && (
                <p className="text-xs text-red-400/80">Prompt is too long</p>
              )}
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#5c4410]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-[#a89585]">
                <FiZap className="h-4 w-4" />
                <span>Press Cmd+Enter to generate</span>
              </div>

              {/* Upload Image Button */}
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[#5c4410] text-[#ffd700] hover:bg-[#5c4410]/30 hover:border-[#ffd700] transition-all"
              >
                <FiUpload className="h-4 w-4" />
                Upload Image
              </button>
            </div>

            <motion.button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`
                flex items-center gap-3 px-8 py-3 rounded-xl font-medium text-lg
                transition-all duration-200
                ${canSubmit
                  ? 'bg-gradient-to-r from-[#ff6b35] to-[#f7c548] text-[#1a1425] hover:shadow-lg hover:shadow-[#ff6b35]/25 hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-[#5c4410]/50 text-[#a89585] cursor-not-allowed'
                }
              `}
              whileHover={canSubmit ? { scale: 1.02 } : {}}
              whileTap={canSubmit ? { scale: 0.98 } : {}}
            >
              {isGenerating ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Game
                  <FiZap className="h-5 w-5" />
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
          className="mt-10"
          id="pick-a-template"
        >
          <p className="text-sm text-[#a89585] mb-6 text-center">
            Or choose a game type to get started:
          </p>

          {/* Pick a Template - Card Style */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-white mb-2">Pick a Template</h3>
            <p className="text-sm text-[#a89585]">Start with a ready-made game template</p>
          </div>

          {/* Template Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { name: 'Platformer', icon: '🏃', color: 'from-[#ff6b35] to-[#f7c548]' },
              { name: 'Shooter', icon: '🔫', color: 'from-red-500 to-orange-500' },
              { name: 'Puzzle', icon: '🧩', color: 'from-[#8b5cf6] to-[#a78bfa]' },
              { name: 'RPG', icon: '⚔️', color: 'from-[#10b981] to-[#34d399]' },
              { name: 'Racing', icon: '🏎️', color: 'from-yellow-500 to-amber-500' },
              { name: 'Tower Defense', icon: '🏰', color: 'from-blue-500 to-cyan-500' },
              { name: 'Adventure', icon: '🗡️', color: 'from-emerald-500 to-teal-500' },
              { name: 'Fighting', icon: '👊', color: 'from-pink-500 to-rose-500' },
            ].map((template, index) => (
              <motion.button
                key={template.name}
                onClick={() => handleTemplateClick(template.name)}
                className={`group relative p-4 rounded-2xl border-2 transition-all duration-300 text-center ${
                  selectedTemplate === template.name
                    ? 'bg-[#1a1425]/80 border-[#ffd700]'
                    : 'bg-[#1a1425]/60 border-[#5c4410] hover:border-[#ffd700]/50'
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <div className={`w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                  <span className="text-2xl">{template.icon}</span>
                </div>
                <span className="text-sm font-medium text-white">{template.name}</span>
              </motion.button>
            ))}
          </div>

          {/* Sub-style Selection */}
          {selectedTemplate && templateStyles[selectedTemplate] && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 p-6 rounded-2xl bg-[#1a1425]/60 border border-[#5c4410]"
            >
              <div className="text-center mb-4">
                <h4 className="text-lg font-bold text-white">Choose your {selectedTemplate} style</h4>
                <p className="text-sm text-[#a89585]">Select a sub-genre to refine your game</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {templateStyles[selectedTemplate].map((style, index) => (
                  <motion.button
                    key={style.name}
                    onClick={() => handleStyleSelect(selectedTemplate, style.name)}
                    className="p-4 rounded-xl bg-[#2d1f3d]/50 border border-[#5c4410] hover:border-[#ffd700]/50 hover:bg-[#5c4410]/30 transition-all text-left"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-base font-bold text-white">{style.name}</span>
                    <p className="text-xs text-[#a89585] mt-1">{style.desc}</p>
                  </motion.button>
                ))}
              </div>
              <div className="text-center mt-4">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="text-sm text-[#a89585] hover:text-[#ffd700] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          {/* Link to Templates Page */}
          <div className="text-center">
            <Link
              href="/templates"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium border-2 border-[#5c4410] text-[#ffd700] hover:bg-[#5c4410]/30 hover:border-[#ffd700] transition-all"
            >
              View All Templates
              <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Tips */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 p-4 rounded-xl bg-[#1a1425]/40 border border-[#5c4410]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ff6b35]/10">
                <FiInfo className="h-4 w-4 text-[#ff6b35]" />
              </div>
              <div>
                <h4 className="font-medium text-sm text-white mb-1">Tips for better games</h4>
                <ul className="text-xs text-[#a89585] space-y-1">
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
