'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiPlay, FiArrowRight, FiZap, FiUsers, FiTrendingUp } from 'react-icons/fi';
import { useState, useEffect } from 'react';

const stats = [
  { label: 'Games Created', value: '50,000+', icon: FiPlay },
  { label: 'Active Creators', value: '10,000+', icon: FiUsers },
  { label: 'Daily Players', value: '100,000+', icon: FiTrendingUp },
];

const floatingGames = [
  { id: 1, title: 'Space Shooter', type: 'Shooter', color: 'from-purple-400 to-pink-400' },
  { id: 2, title: 'Pixel Quest', type: 'Platformer', color: 'from-blue-400 to-cyan-400' },
  { id: 3, title: 'Puzzle Master', type: 'Puzzle', color: 'from-green-400 to-emerald-400' },
  { id: 4, title: 'Racing Pro', type: 'Racing', color: 'from-orange-400 to-red-400' },
  { id: 5, title: 'RPG Adventure', type: 'RPG', color: 'from-indigo-400 to-purple-400' },
];

export function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section className="relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5"></div>
      </div>

      {/* Floating Game Cards */}
      <div className="absolute inset-0 overflow-hidden">
        {floatingGames.map((game, index) => (
          <motion.div
            key={game.id}
            className="absolute"
            initial={{
              x: Math.random() * 1920,
              y: Math.random() * 600,
            }}
            animate={{
              x: mousePosition.x * 0.02 * (index % 2 === 0 ? 1 : -1),
              y: mousePosition.y * 0.02 * (index % 2 === 0 ? -1 : 1),
            }}
            transition={{
              type: 'spring',
              damping: 50,
              stiffness: 100,
            }}
          >
            <div
              className={`rounded-xl bg-gradient-to-br ${game.color} p-4 opacity-10 blur-2xl`}
              style={{
                width: `${150 + index * 20}px`,
                height: `${150 + index * 20}px`,
              }}
            />
          </motion.div>
        ))}
      </div>

      <div className="container relative z-10 py-20 lg:py-32">
        <div className="mx-auto max-w-4xl text-center">
          {/* Announcement Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full bg-primary-100 px-4 py-2 text-sm font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
          >
            <FiZap className="h-4 w-4" />
            <span>New: Viral Growth System with Personal Credits</span>
            <FiArrowRight className="h-4 w-4" />
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 text-5xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white lg:text-6xl xl:text-7xl"
          >
            Create Amazing Games with{' '}
            <span className="text-gradient">AI-Powered Magic</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-10 text-lg text-gray-600 dark:text-gray-300 lg:text-xl"
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
              href="/games"
              className="btn btn-primary px-8 py-3 text-base"
            >
              <FiPlay className="h-5 w-5" />
              Explore Games
            </Link>
            <Link
              href="https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline px-8 py-3 text-base"
            >
              Add to Discord
              <FiArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-16 grid grid-cols-3 gap-8 lg:gap-16"
          >
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center">
                  <div className="mb-2 flex justify-center">
                    <Icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white lg:text-3xl">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
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