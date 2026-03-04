'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX, FiPlay, FiUsers, FiAward, FiInfo, FiPlus, FiZap, FiGlobe } from 'react-icons/fi';
import { clsx } from 'clsx';

const navigation = [
  { name: 'Games', href: '/games', icon: FiPlay },
  { name: 'Creators', href: '/creators', icon: FiUsers },
  { name: 'Leaderboard', href: '/leaderboard', icon: FiAward },
  { name: 'About', href: '/about', icon: FiInfo },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[oklch(var(--border))]/60 bg-[oklch(var(--background))]/80 backdrop-blur-xl">
      <div className="container">
        <nav className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-bold group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 via-secondary-500 to-purple-500 shadow-lg shadow-primary-500/25 group-hover:scale-105 transition-transform">
              <FiZap className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              GameVibe
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'text-white bg-zinc-800/60'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex md:items-center md:gap-3">
            {/* Create Game Button */}
            <Link
              href="/create"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-primary-600 to-secondary-600 text-white hover:shadow-lg hover:shadow-primary-500/25 hover:scale-[1.02] transition-all"
            >
              <FiZap className="h-4 w-4" />
              Create Game
            </Link>

            {/* Add to Discord */}
            <Link
              href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 transition-all"
            >
              <FiGlobe className="h-4 w-4" />
              Add to Discord
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? (
              <FiX className="h-6 w-6 text-white" />
            ) : (
              <FiMenu className="h-6 w-6 text-white" />
            )}
          </button>
        </nav>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-[oklch(var(--border))] bg-[oklch(var(--background))]/95 backdrop-blur-xl md:hidden"
          >
            <div className="container py-4">
              <div className="flex flex-col gap-2">
                {/* Create Game - Mobile */}
                <Link
                  href="/create"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-primary-600 to-secondary-600 text-white"
                >
                  <FiZap className="h-4 w-4" />
                  Create Game
                </Link>

                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={clsx(
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-zinc-800 text-white'
                          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  );
                })}

                <Link
                  href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 mt-2 rounded-xl text-sm font-medium border border-zinc-700 text-zinc-300"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <FiGlobe className="h-4 w-4" />
                  Add to Discord
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
