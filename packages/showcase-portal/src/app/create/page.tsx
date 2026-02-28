'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiZap, FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import { PromptInput } from '@/components/create/prompt-input';
import { GenerationProgress } from '@/components/create/generation-progress';
import { GamePreview } from '@/components/create/game-preview';
import { useGenerationStore } from '@/lib/generation-store';

export default function CreatePage() {
  const { status, updateStep, setStreamingContent, setComplete } = useGenerationStore();
  const runningRef = useRef(false);

  // Simulate AI generation process
  useEffect(() => {
    if (status !== 'analyzing' || runningRef.current) return;
    runningRef.current = true;

    console.log('Starting generation simulation...');

    // Phase 1: Analyzing (1.5s)
    setTimeout(() => {
      console.log('Analyzing complete');
      updateStep('analyzing', { status: 'complete', progress: 100 });

      // Phase 2: Generating (starts after 500ms)
      setTimeout(() => {
        console.log('Starting generating phase');
        const messages = [
          'Analyzing game mechanics...',
          'Creating player controls...',
          'Designing level structure...',
          'Adding enemy AI...',
          'Implementing collision detection...',
        ];
        let messageIndex = 0;

        // Stream messages every 500ms
        const streamInterval = setInterval(() => {
          if (messageIndex < messages.length) {
            setStreamingContent(messages[messageIndex]);
            messageIndex++;
          } else {
            clearInterval(streamInterval);
            updateStep('generating', { status: 'complete', progress: 100 });
            console.log('Generating complete');

            // Phase 3: Building (starts after 500ms)
            setTimeout(() => {
              console.log('Starting building phase');
              let progress = 0;

              const progressInterval = setInterval(() => {
                progress += 20;
                if (progress >= 100) {
                  clearInterval(progressInterval);
                  updateStep('building', { status: 'complete', progress: 100 });
                  console.log('Building complete');

                  // Set complete
                  setComplete({
                    id: 'game-' + Date.now(),
                    title: 'Space Shooter',
                    description: 'An exciting space shooter with power-ups and boss battles!',
                    type: 'SHOOTER',
                    code: `// Generated game code
class Game {
  constructor() {
    this.player = new Player();
    this.enemies = [];
    this.powerUps = [];
    this.score = 0;
  }

  update() {
    this.player.update();
    this.spawnEnemies();
    this.checkCollisions();
  }

  draw(ctx) {
    ctx.clearRect(0, 0, 800, 600);
    this.player.draw(ctx);
    this.enemies.forEach(e => e.draw(ctx));
    this.powerUps.forEach(p => p.draw(ctx));
  }
}`,
                  });
                  console.log('Game complete!');
                  runningRef.current = false;
                } else {
                  updateStep('building', { progress });
                }
              }, 300);
            }, 500);
          }
        }, 500);
      }, 500);
    }, 1500);

  }, [status, updateStep, setStreamingContent, setComplete]);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-500/10 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative container py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          {/* Back Link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-[oklch(var(--muted-foreground))] hover:text-primary-500 mb-6 transition-colors"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          {/* Title */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 text-white shadow-lg">
              <FiZap className="h-6 w-6" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
              Create Your Game
            </h1>
          </div>

          <p className="text-lg text-[oklch(var(--muted-foreground))] max-w-2xl mx-auto">
            Describe your game idea in plain English, and our AI will generate a fully playable game in seconds.
          </p>
        </motion.div>

        {/* Prompt Input */}
        <PromptInput />

        {/* Generation Progress */}
        <GenerationProgress />

        {/* Game Preview */}
        <GamePreview />
      </div>
    </div>
  );
}
