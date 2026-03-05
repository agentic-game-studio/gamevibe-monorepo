'use client';

import Link from 'next/link';
import { FiArrowRight, FiZap, FiGrid } from 'react-icons/fi';
import { FaDiscord } from 'react-icons/fa';

export function CallToAction() {
  return (
    <section className="relative overflow-hidden pb-16 lg:pb-24">
      {/* Background - Theme colors */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1425] via-[#2d1f3d] to-[#1a1425]" />
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#ff6b35]/5 rounded-full blur-[150px]" />

      <div className="container relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-[#1a1425]/60 border border-[#5c4410] px-4 py-2 text-sm font-medium text-[#ffd700]">
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
          <p className="mb-10 text-lg text-[#a89585] lg:text-xl max-w-xl mx-auto">
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
              className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#f7c548] px-8 py-3.5 text-base font-medium text-[#1a1425] transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-[#ff6b35]/30"
            >
              <FiZap className="h-5 w-5" />
              Create Game
            </Link>

            <Link
              href="/create#pick-a-template"
              className="inline-flex items-center gap-2.5 rounded-xl border-2 border-[#5c4410] bg-[#1a1425]/50 px-8 py-3.5 text-base font-medium text-[#ffd700] backdrop-blur-sm transition-all hover:bg-[#5c4410]/30 hover:border-[#ffd700]"
            >
              <FiGrid className="h-5 w-5" />
              Pick a Template
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 flex flex-col items-center justify-center gap-6 sm:flex-row">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">50,000+</div>
              <div className="text-sm text-[#a89585]">Games Created</div>
            </div>
            <div className="hidden h-8 w-px bg-[#5c4410] sm:block"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">5,000+</div>
              <div className="text-sm text-[#a89585]">Discord Servers</div>
            </div>
            <div className="hidden h-8 w-px bg-[#5c4410] sm:block"></div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">100,000+</div>
              <div className="text-sm text-[#a89585]">Daily Players</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
