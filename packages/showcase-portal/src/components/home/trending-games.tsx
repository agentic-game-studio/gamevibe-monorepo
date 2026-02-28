'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { FiPlay, FiShare2, FiTrendingUp, FiLoader } from 'react-icons/fi';
import { apiClient, type TrendingGame } from '@/lib/api-client';
import { clsx } from 'clsx';

const gameTypeColors: Record<string, string> = {
  PLATFORMER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  SHOOTER: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  PUZZLE: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  RPG: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  ENDLESS_RUNNER: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  RACING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  STRATEGY: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
};

function GameCard({ game, index }: { game: TrendingGame; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Link href={`/games/${game.shortId}`} className="block">
        <div className="game-card h-full">
          {/* Thumbnail */}
          <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/20 dark:to-secondary-900/20">
            {game.thumbnailUrl ? (
              <Image
                src={game.thumbnailUrl}
                alt={game.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-110"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <FiPlay className="h-12 w-12 text-gray-400 dark:text-gray-600" />
              </div>
            )}
            
            {/* Trending Badge */}
            {index < 3 && (
              <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-gradient-vibrant px-3 py-1 text-xs font-semibold text-white">
                <FiTrendingUp className="h-3 w-3" />
                #{index + 1} Trending
              </div>
            )}
            
            {/* Game Type */}
            <div className="absolute bottom-2 right-2">
              <span className={clsx(
                'rounded-full px-2 py-1 text-xs font-medium',
                gameTypeColors[game.type] || gameTypeColors.PLATFORMER
              )}>
                {game.type.replace('_', ' ')}
              </span>
            </div>
            
            {/* Overlay */}
            <div className="game-card-overlay flex items-center justify-center">
              <button className="btn btn-primary">
                <FiPlay className="h-4 w-4" />
                Play Now
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-4">
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white line-clamp-1">
              {game.title}
            </h3>
            
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {game.description}
            </p>
            
            {/* Stats */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <FiPlay className="h-3.5 w-3.5" />
                  {game.plays.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <FiShare2 className="h-3.5 w-3.5" />
                  {game.shares.toLocaleString()}
                </span>
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400">
                🔥 {game.uniqueServers} servers
              </div>
            </div>
            
            {/* Creator */}
            {game.creatorName && (
              <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                {game.creatorAvatar && (
                  <Image
                    src={game.creatorAvatar}
                    alt={game.creatorName}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                )}
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  by {game.creatorName}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function TrendingGames() {
  const { data: games, isLoading, error } = useQuery({
    queryKey: ['trending-games'],
    queryFn: () => apiClient.getTrendingGames(8),
  });

  if (isLoading) {
    return (
      <section className="py-20 lg:py-24">
        <div className="container">
          <div className="flex items-center justify-center">
            <FiLoader className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        </div>
      </section>
    );
  }

  if (error || !games) {
    return null;
  }

  return (
    <section className="py-20 lg:py-24">
      <div className="container">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
            🔥 Trending Games
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            The hottest games spreading across Discord servers
          </p>
        </div>
        
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {games.map((game, index) => (
            <GameCard key={game.id} game={game} index={index} />
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <Link href="/games" className="btn btn-outline">
            View All Games
            <FiPlay className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}