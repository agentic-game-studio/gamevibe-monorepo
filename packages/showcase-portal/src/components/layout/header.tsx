'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX, FiPlay, FiUsers, FiAward, FiInfo, FiPlus } from 'react-icons/fi';
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
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-lg dark:border-gray-700 dark:bg-gray-900/80">
      <nav className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold text-gradient"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-brand p-1.5">
            <FiPlay className="h-full w-full text-white" />
          </div>
          <span className="font-display">GameVibe AI</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:gap-8">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex items-center gap-2 text-sm font-medium transition-colors duration-200',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* CTA Button */}
        <div className="hidden md:flex md:items-center md:gap-4">
          <Link
            href="https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            <FiPlus className="h-4 w-4" />
            Add to Discord
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle mobile menu"
        >
          {mobileMenuOpen ? (
            <FiX className="h-6 w-6 text-gray-600 dark:text-gray-300" />
          ) : (
            <FiMenu className="h-6 w-6 text-gray-600 dark:text-gray-300" />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 md:hidden"
          >
            <div className="container py-4">
              <div className="flex flex-col gap-4">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={clsx(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                        isActive
                          ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                          : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  );
                })}
                
                <Link
                  href="https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary mt-2 w-full"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <FiPlus className="h-4 w-4" />
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