'use client';

import { motion } from 'framer-motion';
import { FiZap, FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import { PromptInput } from '@/components/create/prompt-input';
import { GenerationProgress } from '@/components/create/generation-progress';
import { GamePreview } from '@/components/create/game-preview';

export default function CreatePage() {
  return (
    <div className="min-h-screen relative">
      {/* Premium Background - Theme */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1425] via-[#2d1f3d] to-[#1a1425]" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,107,53,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,107,53,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Radial glows */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#ff6b35]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#8b5cf6]/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#ffd700]/5 rounded-full blur-[150px]" />
      </div>

      {/* Content */}
      <div className="relative container py-12">
        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#a89585] hover:text-[#ffd700] transition-colors duration-200"
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
          className="text-center mb-10"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1a1425]/60 border border-[#5c4410] mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-[#ffd700]">AI-Powered Game Generator</span>
          </motion.div>

          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">
            <span className="text-white">Create </span>
            <span className="gold-accent">
              Amazing Games
            </span>
          </h1>

          <p className="text-lg text-[#a89585] max-w-2xl mx-auto leading-relaxed">
            Describe your game in plain English. Our AI generates fully playable games in seconds — no coding required.
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
