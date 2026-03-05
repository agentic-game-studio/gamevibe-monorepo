'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiPlay, FiZap, FiArrowRight, FiGrid } from 'react-icons/fi';

export function Hero() {
  return (
    <section className="relative min-h-[70vh] flex items-center">
      {/* Hero Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/images/hero-bg.webp)' }}
      />

      {/* Overlay for readability */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(26,20,37,0.7) 0%, rgba(26,20,37,0.5) 50%, rgba(13,10,18,0.9) 100%)' }} />

      {/* Main Content */}
      <div className="container relative z-10 py-20">
        <div className="mx-auto max-w-4xl text-center">
          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight"
            style={{ marginTop: '40px' }}
          >
            <span className="text-[#f5e6d3]">Create </span>
            <span className="gold-accent">Epic Games</span>
            <br />
            <span className="text-[#f5e6d3]">with AI Magic</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-10 text-lg md:text-xl text-[#a89585] max-w-2xl mx-auto leading-relaxed"
          >
            Transform your ideas into playable games using natural language.
            No coding required. Play directly in Discord with friends.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link
              href="/create"
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-lg font-medium bg-gradient-to-r from-[#ff6b35] to-[#f7c548] text-[#1a1425] hover:shadow-lg hover:shadow-[#ff6b35]/30 hover:scale-[1.02] transition-all"
            >
              <FiZap className="h-5 w-5" />
              Create Your Game
              <FiArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/create#pick-a-template"
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-lg font-medium border-2 border-[#5c4410] text-[#ffd700] hover:bg-[#5c4410]/30 hover:border-[#ffd700] transition-all"
            >
              <FiGrid className="h-5 w-5" />
              Pick a Template
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0d0a12] to-transparent" />
    </section>
  );
}
