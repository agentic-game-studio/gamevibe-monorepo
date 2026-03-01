'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { FiArrowRight, FiZap } from 'react-icons/fi';
import { FaDiscord } from 'react-icons/fa';

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
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-transparent to-secondary-900/20" />

      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {floatingElements.map((el, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-primary-500/5"
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
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-zinc-900/60 border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Join 10,000+ creators</span>
          </div>

          {/* Heading */}
          <h2 className="mb-6 text-4xl font-bold text-white lg:text-5xl">
            Ready to Create Your First Game?
          </h2>

          {/* Description */}
          <p className="mb-10 text-lg text-zinc-400 lg:text-xl max-w-xl mx-auto">
            Start creating amazing games with AI today. No coding required.
            Add GameVibe to your Discord server and unleash your creativity.
          </p>

          {/* Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2.5 rounded-xl bg-[#5865F2] px-8 py-3.5 text-base font-medium text-white hover:bg-[#4752c4] transition-all hover:scale-[1.02]"
            >
              <FaDiscord className="h-5 w-5" />
              Add to Discord
              <FiArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <Link
              href="/create"
              className="inline-flex items-center gap-2.5 rounded-xl border border-zinc-700 bg-zinc-800/50 px-8 py-3.5 text-base font-medium text-white backdrop-blur-sm transition-all hover:bg-zinc-800 hover:border-zinc-600"
            >
              <FiZap className="h-5 w-5" />
              Create Game
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 flex flex-col items-center justify-center gap-6 sm:flex-row">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">50,000+</div>
              <div className="text-sm text-zinc-500">Games Created</div>
            </div>
            <div className="hidden h-8 w-px bg-zinc-800 sm:block"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">5,000+</div>
              <div className="text-sm text-zinc-500">Discord Servers</div>
            </div>
            <div className="hidden h-8 w-px bg-zinc-800 sm:block"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">100,000+</div>
              <div className="text-sm text-zinc-500">Daily Players</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
