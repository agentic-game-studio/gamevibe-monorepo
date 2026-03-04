'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { FiPlay, FiDollarSign, FiAward, FiArrowRight } from 'react-icons/fi';
import { apiClient, type Creator } from '@/lib/api-client';
import { clsx } from 'clsx';
import { CreatorCardSkeleton } from '@/components/skeleton';

const tierStyles = {
  BRONZE: {
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    border: 'border-orange-500/30',
    gradient: 'from-orange-500 to-amber-500',
  },
  SILVER: {
    badge: 'bg-zinc-400/20 text-zinc-300 border-zinc-500/30',
    border: 'border-zinc-500/30',
    gradient: 'from-zinc-400 to-zinc-500',
  },
  GOLD: {
    badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    border: 'border-yellow-500/30',
    gradient: 'from-yellow-500 to-amber-500',
  },
  DIAMOND: {
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    border: 'border-blue-500/30',
    gradient: 'from-blue-500 to-cyan-500',
  },
};

function CreatorCard({ creator, rank }: { creator: Creator; rank: number }) {
  const tierStyle = tierStyles[creator.tier];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: rank * 0.1 }}
    >
      <Link href={`/creators/${creator.userId}`} className="block group">
        <div className={clsx(
          'relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-zinc-800 p-5 transition-all duration-300 hover:border-zinc-700 hover:shadow-lg',
          tierStyle.border
        )}>
          {/* Glow Effect */}
          <div className={clsx(
            'absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100',
            `from-${tierStyle.gradient.split(' ')[1].replace('500', '500/10')} to-${tierStyle.gradient.split(' ')[3]?.replace('500', '500/10') || 'transparent'}`
          )} />

          {/* Rank Badge */}
          {rank < 3 && (
            <div className="absolute right-4 top-4">
              <div className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                rank === 0 && 'bg-yellow-500 text-white',
                rank === 1 && 'bg-zinc-400 text-white',
                rank === 2 && 'bg-orange-600 text-white'
              )}>
                {rank + 1}
              </div>
            </div>
          )}

          <div className="relative z-10">
            {/* Avatar & Name */}
            <div className="mb-4 flex items-center gap-4">
              <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500">
                {creator.avatar ? (
                  <Image
                    src={creator.avatar}
                    alt={creator.username}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold text-white">
                    {creator.username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate group-hover:text-primary-400 transition-colors">
                  {creator.username}
                </h3>
                <span className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border',
                  tierStyle.badge
                )}>
                  {creator.tier}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4 text-zinc-500">
                <span className="flex items-center gap-1">
                  <FiPlay className="h-3.5 w-3.5" />
                  {creator.gamesCreated || 0}
                </span>
                <span className="flex items-center gap-1">
                  <FiDollarSign className="h-3.5 w-3.5" />
                  {creator.lifetimeEarned?.toLocaleString() || 0}
                </span>
              </div>
              <span className="text-primary-400 flex items-center gap-1">
                View <FiArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function FeaturedCreators() {
  const { data: creators, isLoading } = useQuery({
    queryKey: ['featured-creators'],
    queryFn: () => apiClient.getTopCreators(4),
  });

  return (
    <section className="py-20 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[oklch(var(--background))]">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[120px]" />
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
              <FiAward className="h-5 w-5 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">Top Creators</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Featured Creators
            </h2>
          </div>
          <Link
            href="/creators"
            className="hidden md:flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            View All
            <FiArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {/* Creators Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <CreatorCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {creators?.map((creator, index) => (
              <CreatorCard key={creator.userId} creator={creator} rank={index} />
            ))}
          </div>
        )}

        {/* Mobile View All */}
        <div className="mt-8 text-center md:hidden">
          <Link
            href="/creators"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
          >
            View All Creators
            <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
