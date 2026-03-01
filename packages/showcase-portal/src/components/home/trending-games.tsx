'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { FiPlay, FiShare2, FiTrendingUp, FiArrowRight } from 'react-icons/fi';
import { apiClient, type TrendingGame } from '@/lib/api-client';
import { clsx } from 'clsx';
import { GameCardSkeleton } from '@/components/skeleton';

const gameTypeColors: Record<string, string> = {
  PLATFORMER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SHOOTER: 'bg-red-500/20 text-red-400 border-red-500/30',
  PUZZLE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  RPG: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  ENDLESS_RUNNER: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  RACING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  STRATEGY: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

function GameCard({ game, index }: { game: TrendingGame; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Link href={`/games/${game.shortId}`} className="block group">
        <div className="h-full rounded-2xl bg-zinc-900/40 border border-zinc-800 overflow-hidden transition-all duration-300 hover:border-zinc-700 hover:shadow-lg hover:shadow-primary-500/10">
          {/* Thumbnail */}
          <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
            {game.thumbnailUrl ? (
              <Image
                src={game.thumbnailUrl}
                alt={game.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <FiPlay className="h-8 w-8 text-zinc-600" />
                </div>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />

            {/* Trending Badge */}
            {index < 3 && (
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-zinc-950/80 backdrop-blur-sm border border-zinc-800 px-3 py-1.5 text-xs font-semibold text-white">
                <FiTrendingUp className="h-3 w-3 text-primary-400" />
                #{index + 1}
              </div>
            )}

            {/* Game Type */}
            <div className="absolute bottom-3 right-3">
              <span className={clsx(
                'rounded-full px-2.5 py-1 text-xs font-medium border',
                gameTypeColors[game.type] || gameTypeColors.PLATFORMER
              )}>
                {game.type.replace('_', ' ')}
              </span>
            </div>

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-zinc-900 font-medium">
                <FiPlay className="h-4 w-4" />
                Play Now
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="mb-2 text-base font-semibold text-white line-clamp-1 group-hover:text-primary-400 transition-colors">
              {game.title}
            </h3>

            <p className="mb-4 text-sm text-zinc-500 line-clamp-2">
              {game.description}
            </p>

            {/* Stats */}
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <FiPlay className="h-3 w-3" />
                  {game.plays || 0}
                </span>
                <span className="flex items-center gap-1">
                  <FiShare2 className="h-3 w-3" />
                  {game.shares || 0}
                </span>
              </div>
              <span className="text-primary-400">View Game</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function TrendingGames() {
  const { data: games, isLoading } = useQuery({
    queryKey: ['trending-games'],
    queryFn: () => apiClient.getTrendingGames(6),
  });

  return (
    <section className="py-20 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[#0a0a0f]">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-[120px]" />
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
              <FiTrendingUp className="h-5 w-5 text-primary-400" />
              <span className="text-sm font-medium text-primary-400">Trending Now</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Most Played Games
            </h2>
          </div>
          <Link
            href="/games"
            className="hidden md:flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            View All
            <FiArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {/* Games Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games?.map((game, index) => (
              <GameCard key={game.id} game={game} index={index} />
            ))}
          </div>
        )}

        {/* Mobile View All */}
        <div className="mt-8 text-center md:hidden">
          <Link
            href="/games"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            View All Games
            <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
