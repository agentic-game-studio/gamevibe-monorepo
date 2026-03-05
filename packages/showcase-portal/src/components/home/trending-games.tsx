'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { FiTrendingUp, FiArrowRight, FiUsers } from 'react-icons/fi';

// Mock trending games data (placeholder)
const mockTrendingGames = [
  {
    id: '1',
    title: 'Neon Runner',
    genre: 'Endless Runner',
    creator: '@pixelmaster',
    plays: '12.4K',
    forks: '892',
  },
  {
    id: '2',
    title: 'Dungeon Quest',
    genre: 'RPG',
    creator: '@questlord',
    plays: '8.7K',
    forks: '654',
  },
  {
    id: '3',
    title: 'Space Blaster',
    genre: 'Shooter',
    creator: '@stargamer',
    plays: '15.2K',
    forks: '1.2K',
  },
  {
    id: '4',
    title: 'Puzzle Realm',
    genre: 'Puzzle',
    creator: '@brainwave',
    plays: '6.9K',
    forks: '421',
  },
  {
    id: '5',
    title: 'Cozy Farm',
    genre: 'Simulation',
    creator: '@relaxgaming',
    plays: '9.3K',
    forks: '783',
  },
  {
    id: '6',
    title: 'Horror Night',
    genre: 'Horror',
    creator: '@scarebuilder',
    plays: '11.1K',
    forks: '567',
  },
  {
    id: '7',
    title: 'Dragon Rise',
    genre: 'Adventure',
    creator: '@dragonlord',
    plays: '18.5K',
    forks: '1.5K',
  },
  {
    id: '8',
    title: 'Speed Racer',
    genre: 'Racing',
    creator: '@speeddemon',
    plays: '7.2K',
    forks: '312',
  },
  {
    id: '9',
    title: 'Zombie Defense',
    genre: 'Tower Defense',
    creator: '@defendermaster',
    plays: '14.8K',
    forks: '945',
  },
];

function GameBoxCard({ game, index }: { game: typeof mockTrendingGames[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Link href={`/games/${game.id}`} className="block group">
        <div className="relative">
          {/* 2x Large Game Box Container */}
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border-[6px] border-[#5c4410] shadow-[0_0_40px_rgba(255,107,53,0.25),0_12px_40px_rgba(0,0,0,0.5)] transition-all duration-300 group-hover:shadow-[0_0_60px_rgba(255,107,53,0.4),0_16px_50px_rgba(0,0,0,0.6)] group-hover:scale-[1.02] group-hover:border-[#ffd700]/60">
            {/* Game Box Background - Theme colors */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1425] via-[#2d1f3d] to-[#1a1425]">
              {/* Decorative grid pattern - tavern style */}
              <div className="absolute inset-0 opacity-40" style={{
                backgroundImage: `
                  linear-gradient(rgba(255,107,53,0.2) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,107,53,0.2) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px'
              }} />

              {/* Retro game box border */}
              <div className="absolute inset-4 border-[3px] border-dashed border-[#5c4410]/60 rounded-xl" />

              {/* Game title area */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-full px-4">
                {/* Game icon - 2x larger */}
                <div className="w-32 h-32 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#ff6b35]/30 to-[#f7c548]/30 border-[3px] border-[#5c4410] flex items-center justify-center shadow-inner">
                  <span className="text-6xl filter drop-shadow-lg">🎮</span>
                </div>

                {/* Game title - 2x larger */}
                <h3 className="text-3xl font-bold text-white drop-shadow-lg leading-tight">
                  {game.title}
                </h3>

                {/* Creator */}
                <p className="mt-2 text-sm text-[#ffd700] font-medium">
                  {game.creator}
                </p>
              </div>

              {/* Genre badge - top left - 2x larger */}
              <div className="absolute top-5 left-5">
                <span className="px-4 py-2 text-sm font-bold bg-gradient-to-r from-[#ff6b35] to-[#f7c548] text-[#1a1425] rounded-lg shadow-lg tracking-wide">
                  {game.genre}
                </span>
              </div>

              {/* Trending #1-3 badge - top right - 2x larger */}
              {index < 3 && (
                <div className="absolute top-5 right-5 w-14 h-14 flex items-center justify-center bg-gradient-to-r from-[#ffd700] to-[#ffaa00] text-[#1a1425] font-bold text-2xl rounded-xl shadow-lg">
                  #{index + 1}
                </div>
              )}

              {/* Stats - bottom of box - 2x larger */}
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/90 text-lg">
                  <FiUsers className="h-5 w-5" />
                  {game.forks}
                </div>
                <div className="text-white/90 text-lg font-medium">
                  {game.plays}
                </div>
              </div>
            </div>

            {/* Play overlay - 2x larger button */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1425]/90 via-[#1a1425]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <div className="px-12 py-5 rounded-2xl bg-gradient-to-r from-[#ff6b35] to-[#f7c548] text-[#1a1425] font-bold text-2xl shadow-[0_0_40px_rgba(255,107,53,0.6)]">
                PLAY NOW
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function TrendingGames() {
  return (
    <section className="py-24 relative">
      {/* Background - Theme tavern style */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1425] via-[#2d1f3d] to-[#1a1425]">
        <div className="absolute inset-0 bg-grid opacity-20" />
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#ff6b35]/5 rounded-full blur-[150px]" />
      </div>

      <div className="container relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FiTrendingUp className="h-5 w-5 text-[#ff6b35]" />
              <span className="text-sm font-medium text-[#ff6b35]">Hot This Week</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Trending Games
            </h2>
          </div>
          <Link
            href="/games"
            className="hidden md:flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-[#ffd700] transition-colors"
          >
            View All
            <FiArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {/* Games Grid - 2x larger boxes, 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {mockTrendingGames.map((game, index) => (
            <GameBoxCard key={game.id} game={game} index={index} />
          ))}
        </div>

        {/* Mobile View All */}
        <div className="mt-8 text-center md:hidden">
          <Link
            href="/games"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-[#ffd700] transition-colors"
          >
            View All Games
            <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
