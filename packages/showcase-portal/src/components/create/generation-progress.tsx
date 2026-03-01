'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiCpu, FiCode, FiImage, FiLoader } from 'react-icons/fi';
import { useGenerationStore } from '@/lib/generation-store';

const stepIcons = {
  analyzing: FiCpu,
  generating: FiCode,
  building: FiImage,
};

const stepColors = {
  analyzing: 'from-blue-500 to-cyan-500',
  generating: 'from-purple-500 to-pink-500',
  building: 'from-emerald-500 to-teal-500',
};

export function GenerationProgress() {
  const { status, steps, streamingContent } = useGenerationStore();

  if (status === 'idle' || status === 'complete' || status === 'error') {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-2xl mx-auto mt-8"
    >
      <div className="relative">
        {/* Connection line */}
        <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-zinc-800 via-zinc-700 to-zinc-800" />

        {/* Steps */}
        <div className="space-y-6">
          {steps.map((step, index) => {
            const Icon = stepIcons[step.id as keyof typeof stepIcons];
            const gradient = stepColors[step.id as keyof typeof stepColors];
            const isActive = step.status === 'in_progress';
            const isComplete = step.status === 'complete';

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-4 relative"
              >
                {/* Step Icon */}
                <div
                  className={`
                    relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl
                    transition-all duration-300
                    ${isComplete
                      ? 'bg-emerald-500 text-white'
                      : isActive
                        ? `bg-gradient-to-br ${gradient} text-white shadow-lg shadow-primary-500/25`
                        : 'bg-zinc-800 text-zinc-500'
                    }
                  `}
                >
                  {isComplete ? (
                    <FiCheck className="h-5 w-5" />
                  ) : isActive ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <FiLoader className="h-5 w-5" />
                    </motion.div>
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}

                  {/* Active glow */}
                  {isActive && (
                    <motion.div
                      className={`absolute inset-0 rounded-xl bg-gradient-to-br ${gradient}`}
                      animate={{
                        boxShadow: [
                          '0 0 0 0 rgba(14, 165, 233, 0.4)',
                          '0 0 0 12px rgba(14, 165, 233, 0)',
                        ],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                      }}
                    />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 pt-1">
                  <h3
                    className={`
                      font-semibold text-base
                      ${isActive || isComplete
                        ? 'text-white'
                        : 'text-zinc-500'
                      }
                    `}
                  >
                    {step.title}
                  </h3>
                  <p className="text-sm text-zinc-500 mt-0.5">
                    {step.description}
                  </p>

                  {/* Progress bar */}
                  {isActive && (
                    <motion.div
                      className="mt-3 h-1.5 rounded-full bg-zinc-800 overflow-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{
                          duration: 3,
                          ease: 'easeInOut',
                        }}
                      />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Streaming content preview */}
        <AnimatePresence>
          {streamingContent && status === 'generating' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800"
            >
              <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                </span>
                AI is thinking...
              </p>
              <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap line-clamp-3">
                {streamingContent}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
