'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiZap, FiArrowLeft, FiCpu, FiTarget, FiUsers, FiArrowRight, FiCode, FiLayers, FiActivity } from 'react-icons/fi';
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

    // Phase 1: Analyzing (1.5s)
    setTimeout(() => {
      updateStep('analyzing', { status: 'complete', progress: 100 });

      // Phase 2: Generating (starts after 500ms)
      setTimeout(() => {
        const messages = [
          'Analyzing game mechanics...',
          'Creating player controls...',
          'Designing level structure...',
          'Adding enemy AI...',
          'Implementing collision detection...',
        ];
        let messageIndex = 0;

        const streamInterval = setInterval(() => {
          if (messageIndex < messages.length) {
            setStreamingContent(messages[messageIndex]);
            messageIndex++;
          } else {
            clearInterval(streamInterval);
            updateStep('generating', { status: 'complete', progress: 100 });

            // Phase 3: Building (starts after 500ms)
            setTimeout(() => {
              let progress = 0;

              const progressInterval = setInterval(() => {
                progress += 20;
                if (progress >= 100) {
                  clearInterval(progressInterval);
                  updateStep('building', { status: 'complete', progress: 100 });

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
    <div className="min-h-[calc(100vh-4rem)] relative overflow-hidden">
      {/* Premium Background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-[oklch(var(--background))]" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Radial glows */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary-500/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-secondary-500/6 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Content */}
      <div className="relative container py-16">
        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors duration-200"
          >
            <FiArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800 mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-zinc-400">AI-Powered Game Generator</span>
          </motion.div>

          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">
            <span className="text-white">Create </span>
            <span className="bg-gradient-to-r from-primary-400 via-secondary-400 to-purple-400 bg-clip-text text-transparent">
              Amazing Games
            </span>
          </h1>

          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Describe your game in plain English. Our AI generates fully playable games in seconds — no coding required.
          </p>
        </motion.div>

        {/* Features - Premium Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12"
        >
          {[
            { icon: FiCpu, title: 'AI Generation', desc: 'Smart code creation', color: 'from-blue-500 to-cyan-500' },
            { icon: FiLayers, title: 'Multiple Types', desc: 'Platformers, shooters, puzzles', color: 'from-purple-500 to-pink-500' },
            { icon: FiCode, title: 'Clean Code', desc: 'Learn & modify', color: 'from-emerald-500 to-teal-500' },
            { icon: FiActivity, title: 'Instant Play', desc: 'No setup required', color: 'from-orange-500 to-red-500' },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="group relative p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/60 hover:border-zinc-700 transition-all duration-300"
            >
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              <div className="relative">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                <p className="text-sm text-zinc-500">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
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
