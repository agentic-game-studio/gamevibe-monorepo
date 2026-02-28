'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { FiAward, FiPlay, FiDollarSign, FiLoader, FiAward as FiTrophy } from 'react-icons/fi';
import { apiClient, type Creator } from '@/lib/api-client';
import { clsx } from 'clsx';

const tierStyles = {
  BRONZE: {
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    glow: 'from-orange-500/20 to-orange-600/20',
  },
  SILVER: {
    badge: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-800',
    glow: 'from-gray-500/20 to-gray-600/20',
  },
  GOLD: {
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
    glow: 'from-yellow-500/20 to-yellow-600/20',
  },
  DIAMOND: {
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    glow: 'from-blue-500/20 to-blue-600/20',
  },
};

function CreatorCard({ creator, rank }: { creator: Creator; rank: number }) {
  const tierStyle = tierStyles[creator.tier];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: rank * 0.1 }}
    >
      <Link href={`/creators/${creator.userId}`} className="block">
        <div className={clsx(
          'group relative overflow-hidden rounded-xl border-2 bg-white p-6 transition-all duration-300 hover:shadow-xl dark:bg-gray-800',
          tierStyle.border
        )}>
          {/* Glow Effect */}
          <div className={clsx(
            'absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100',
            tierStyle.glow
          )} />
          
          {/* Rank Badge */}
          {rank <= 3 && (
            <div className="absolute right-4 top-4">
              <div className={clsx(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                rank === 1 && 'bg-yellow-500 text-white',
                rank === 2 && 'bg-gray-400 text-white',
                rank === 3 && 'bg-orange-600 text-white'
              )}>
                {rank}
              </div>
            </div>
          )}
          
          <div className="relative z-10">
            {/* Avatar & Name */}
            <div className="mb-4 flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-full bg-gradient-to-br from-primary-400 to-secondary-400">
                {creator.avatar ? (
                  <Image
                    src={creator.avatar}
                    alt={creator.username}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl font-bold text-white">
                    {creator.username[0].toUpperCase()}
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {creator.username}
                </h3>
                <span className={clsx(
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  tierStyle.badge
                )}>
                  {creator.tier}
                </span>
              </div>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  <FiPlay className="h-3.5 w-3.5" />
                  Games
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {creator.gamesCreated}
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  <FiDollarSign className="h-3.5 w-3.5" />
                  Earned
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {creator.lifetimeEarned.toLocaleString()}
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  <FiTrophy className="h-3.5 w-3.5" />
                  Total Plays
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {creator.totalPlays.toLocaleString()}
                </div>
              </div>
              
              <div>
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  🌐 Servers
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {creator.uniqueServers}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function FeaturedCreators() {
  const { data: creators, isLoading, error } = useQuery({
    queryKey: ['top-creators'],
    queryFn: () => apiClient.getTopCreators(6),
  });

  if (isLoading) {
    return (
      <section className="bg-gray-50 py-20 dark:bg-gray-900/50 lg:py-24">
        <div className="container">
          <div className="flex items-center justify-center">
            <FiLoader className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        </div>
      </section>
    );
  }

  if (error || !creators) {
    return null;
  }

  return (
    <section className="bg-gray-50 py-20 dark:bg-gray-900/50 lg:py-24">
      <div className="container">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
            ⭐ Featured Creators
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Top game creators earning rewards through viral growth
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {creators.map((creator, index) => (
            <CreatorCard key={creator.userId} creator={creator} rank={index + 1} />
          ))}
        </div>
        
        <div className="mt-12 text-center">
          <Link href="/creators" className="btn btn-outline">
            View All Creators
            <FiTrophy className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}