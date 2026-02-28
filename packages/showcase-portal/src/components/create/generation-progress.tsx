'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FiCheck, FiCpu, FiCode, FiImage } from 'react-icons/fi';
import { useGenerationStore } from '@/lib/generation-store';

const stepIcons = {
  analyzing: FiCpu,
  generating: FiCode,
  building: FiImage,
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
        <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-[oklch(var(--border))]" />

        {/* Steps */}
        <div className="space-y-6">
          {steps.map((step, index) => {
            const Icon = stepIcons[step.id as keyof typeof stepIcons];
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
                    relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full
                    transition-all duration-300
                    ${isComplete
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-gradient-to-br from-primary-500 to-secondary-500 text-white shadow-lg'
                        : 'bg-[oklch(var(--muted))] text-[oklch(var(--muted-foreground))]'
                    }
                  `}
                >
                  {isComplete ? (
                    <FiCheck className="h-5 w-5" />
                  ) : isActive ? (
                    <Icon className="h-5 w-5 animate-pulse" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}

                  {/* Active glow */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500"
                      animate={{
                        boxShadow: [
                          '0 0 0 0 rgba(14, 165, 233, 0.4)',
                          '0 0 0 8px rgba(14, 165, 233, 0)',
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
                <div className="flex-1 pt-1.5">
                  <h3
                    className={`
                      font-semibold text-base
                      ${isActive || isComplete
                        ? 'text-[oklch(var(--foreground))]'
                        : 'text-[oklch(var(--muted-foreground))]'
                      }
                    `}
                  >
                    {step.title}
                  </h3>
                  <p className="text-sm text-[oklch(var(--muted-foreground))] mt-0.5">
                    {step.description}
                  </p>

                  {/* Progress bar */}
                  {isActive && (
                    <motion.div
                      className="mt-3 h-1.5 rounded-full bg-[oklch(var(--muted))] overflow-hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-secondary-500"
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
              className="mt-6 p-4 rounded-xl bg-[oklch(var(--muted))]/30 border border-[oklch(var(--border))]"
            >
              <p className="text-xs text-[oklch(var(--muted-foreground))] mb-2 uppercase tracking-wider">
                AI is thinking...
              </p>
              <pre className="text-sm text-[oklch(var(--foreground))] font-mono whitespace-pre-wrap line-clamp-3">
                {streamingContent}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
