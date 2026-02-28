'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { FiArrowRight, FiZap } from 'react-icons/fi';
import { FaDiscord } from 'react-icons/fa';

// Deterministic floating element positions to avoid hydration mismatch
const floatingElements = [
  { x: 150, y: 120, size: 256 },
  { x: 900, y: 200, size: 192 },
  { x: 1600, y: 100, size: 224 },
  { x: 500, y: 500, size: 288 },
  { x: 1400, y: 450, size: 176 },
];

export function CallToAction() {
  return (
    <section className="relative overflow-hidden py-20 lg:py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-600">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10"></div>
      </div>

      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {floatingElements.map((el, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/5"
            style={{
              width: el.size,
              height: el.size,
            }}
            initial={{
              x: el.x,
              y: el.y,
            }}
            animate={{
              x: [el.x, el.x + 50, el.x - 30, el.x],
              y: [el.y, el.y - 40, el.y + 20, el.y],
            }}
            transition={{
              duration: 20 + i * 5,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'linear',
            }}
          />
        ))}
      </div>

      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
            <FiZap className="h-4 w-4" />
            <span>Join 10,000+ creators</span>
          </div>

          {/* Heading */}
          <h2 className="mb-6 text-4xl font-bold text-white lg:text-5xl">
            Ready to Create Your First Game?
          </h2>

          {/* Description */}
          <p className="mb-10 text-lg text-white/90 lg:text-xl">
            Start creating amazing games with AI today. No coding required.
            Add GameVibe to your Discord server and unleash your creativity.
          </p>

          {/* Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-base font-semibold text-primary-600 transition-all duration-200 hover:bg-gray-100"
            >
              <FaDiscord className="h-5 w-5" />
              Add to Discord
              <FiArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <Link
              href="/games"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-white/20 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-white/20"
            >
              Browse Games
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 flex flex-col items-center justify-center gap-8 sm:flex-row">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">50,000+</div>
              <div className="text-sm text-white/70">Games Created</div>
            </div>
            <div className="hidden h-8 w-px bg-white/20 sm:block"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">5,000+</div>
              <div className="text-sm text-white/70">Discord Servers</div>
            </div>
            <div className="hidden h-8 w-px bg-white/20 sm:block"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">100,000+</div>
              <div className="text-sm text-white/70">Daily Players</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}