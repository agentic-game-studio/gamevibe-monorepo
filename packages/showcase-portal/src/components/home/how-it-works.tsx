'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FiMessageSquare, FiZap, FiPlay, FiDollarSign } from 'react-icons/fi';

const steps = [
  {
    number: '01',
    title: 'Describe Your Game',
    description: 'Use natural language to tell the AI what kind of game you want to create. Be as creative as you like!',
    icon: FiMessageSquare,
    gradient: 'from-[#ff6b35] to-[#f7c548]',
  },
  {
    number: '02',
    title: 'AI Creates Everything',
    description: 'Our AI generates the game code, sprites, backgrounds, and sound effects automatically.',
    icon: FiZap,
    gradient: 'from-[#8b5cf6] to-[#a78bfa]',
  },
  {
    number: '03',
    title: 'Play with Friends',
    description: 'Launch your game directly in Discord. Friends can join instantly without downloads.',
    icon: FiPlay,
    gradient: 'from-[#10b981] to-[#34d399]',
  },
  {
    number: '04',
    title: 'Earn Credits',
    description: 'Get credits when people play your games. Unlock higher tiers and earn more as you grow.',
    icon: FiDollarSign,
    gradient: 'from-[#ffd700] to-[#fbbf24]',
  },
];

function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const Icon = step.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="relative text-center"
    >
      {/* Connection Line */}
      {index < steps.length - 1 && (
        <div className="absolute left-1/2 top-16 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-[#5c4410] via-[#5c4410]/50 to-transparent lg:block" />
      )}

      <div className="group relative inline-block w-full">
        {/* Step Number - Above the card */}
        <div className="mb-4">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-[#ff6b35] to-[#f7c548] text-[#1a1425] font-bold text-xl shadow-lg">
            {step.number}
          </span>
        </div>

        {/* Card */}
        <div className="relative z-10 rounded-2xl bg-gradient-to-br from-[#1a1425] to-[#2d1f3d] border-2 border-[#5c4410] p-6 transition-all duration-300 hover:border-[#ffd700]/60 hover:shadow-[0_0_40px_rgba(255,107,53,0.2)]">
          {/* Icon */}
          <div className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${step.gradient} p-4 shadow-lg`}>
            <Icon className="h-8 w-8 text-white" />
          </div>

          {/* Content */}
          <h3 className="mb-3 text-xl font-bold text-white">
            {step.title}
          </h3>
          <p className="text-sm text-[#a89585] leading-relaxed">
            {step.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section className="py-20 lg:py-24 relative">
      {/* Background - Theme colors */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1425] via-[#2d1f3d] to-[#1a1425]" />
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ff6b35]/5 rounded-full blur-[150px]" />

      <div className="container relative z-10">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl md:text-4xl font-bold text-white">
            How It Works
          </h2>
          <p className="text-lg text-[#a89585]">
            From idea to playable game in minutes
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 lg:grid-cols-4 lg:gap-6">
            {steps.map((step, index) => (
              <StepCard key={step.number} step={step} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
