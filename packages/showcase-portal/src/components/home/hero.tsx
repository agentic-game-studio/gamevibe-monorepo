'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiPlay, FiArrowRight, FiZap, FiUsers, FiTrendingUp, FiGlobe } from 'react-icons/fi';
import { useState, useEffect, useMemo } from 'react';

const stats = [
  { label: 'Games Created', value: '50,000+', icon: FiPlay },
  { label: 'Active Creators', value: '10,000+', icon: FiUsers },
  { label: 'Daily Players', value: '100,000+', icon: FiTrendingUp },
];

const floatingGames = [
  { id: 1, title: 'Space Shooter', type: 'Shooter', color: 'from-purple-500 to-pink-500' },
  { id: 2, title: 'Pixel Quest', type: 'Platformer', color: 'from-blue-500 to-cyan-500' },
  { id: 3, title: 'Puzzle Master', type: 'Puzzle', color: 'from-emerald-500 to-teal-500' },
  { id: 4, title: 'Racing Pro', type: 'Racing', color: 'from-orange-500 to-red-500' },
  { id: 5, title: 'RPG Adventure', type: 'RPG', color: 'from-indigo-500 to-purple-500' },
];

const deterministicPositions = [
  { x: 200, y: 150 },
  { x: 850, y: 80 },
  { x: 1600, y: 200 },
  { x: 400, y: 400 },
  { x: 1200, y: 350 },
];

export function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const gamePositions = useMemo(() => {
    return floatingGames.map((game, index) => ({
      ...game,
      initialX: deterministicPositions[index].x,
      initialY: deterministicPositions[index].y,
    }));
  }, []);

  return (
    <section className="relative overflow-hidden min-h-screen flex items-center">
      {/* Premium Background */}
      <div className="absolute inset-0 bg-[#0a0a0f]">
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-grid opacity-50" />

        {/* Radial Glows */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-secondary-500/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Floating Game Cards */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {gamePositions.map((game, index) => (
          <motion.div
            key={game.id}
            className="absolute"
            initial={{
              x: game.initialX,
              y: game.initialY,
            }}
            animate={{
              x: isMounted ? mousePosition.x * 0.015 * (index % 2 === 0 ? 1 : -1) + game.initialX : game.initialX,
              y: isMounted ? mousePosition.y * 0.015 * (index % 2 === 0 ? -1 : 1) + game.initialY : game.initialY,
            }}
            transition={{
              type: 'spring',
              damping: 50,
              stiffness: 100,
            }}
          >
            <div
              className={`rounded-2xl bg-gradient-to-br ${game.color} p-6 opacity-20 blur-3xl`}
              style={{
                width: `${180 + index * 25}px`,
                height: `${180 + index * 25}px`,
              }}
            />
          </motion.div>
        ))}
      </div>

      <div className="container relative z-10 py-32">
        <div className="mx-auto max-w-4xl text-center">
          {/* Announcement Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/60 border border-zinc-800"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium text-zinc-400">New: Viral Growth System</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight"
          >
            <span className="text-white">Create </span>
            <span className="bg-gradient-to-r from-primary-400 via-secondary-400 to-purple-400 bg-clip-text text-transparent">
              Amazing Games
            </span>
            <br />
            <span className="text-white">with AI Magic</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-10 text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
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
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-medium bg-gradient-to-r from-primary-600 to-secondary-600 text-white hover:shadow-lg hover:shadow-primary-500/25 hover:scale-[1.02] transition-all"
            >
              <FiZap className="h-5 w-5" />
              Create Your Game
              <FiArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/games"
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 transition-all"
            >
              <FiPlay className="h-5 w-5" />
              Explore Games
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-20 grid grid-cols-3 gap-8 lg:gap-16"
          >
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center">
                  <div className="mb-3 flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900/60 border border-zinc-800">
                      <Icon className="h-6 w-6 text-primary-400" />
                    </div>
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-white">
                    {stat.value}
                  </div>
                  <div className="text-sm text-zinc-500 mt-1">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
