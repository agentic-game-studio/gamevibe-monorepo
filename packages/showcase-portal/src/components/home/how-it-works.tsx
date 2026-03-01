'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FiMessageSquare, FiZap, FiPlay, FiDollarSign, FiArrowRight } from 'react-icons/fi';

const steps = [
  {
    number: '01',
    title: 'Describe Your Game',
    description: 'Use natural language to tell the AI what kind of game you want to create. Be as creative as you like!',
    icon: FiMessageSquare,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    number: '02',
    title: 'AI Creates Everything',
    description: 'Our AI generates the game code, sprites, backgrounds, and sound effects automatically.',
    icon: FiZap,
    color: 'from-purple-500 to-pink-500',
  },
  {
    number: '03',
    title: 'Play with Friends',
    description: 'Launch your game directly in Discord. Friends can join instantly without downloads.',
    icon: FiPlay,
    color: 'from-emerald-500 to-teal-500',
  },
  {
    number: '04',
    title: 'Earn Credits',
    description: 'Get credits when people play your games. Unlock higher tiers and earn more as you grow.',
    icon: FiDollarSign,
    color: 'from-orange-500 to-red-500',
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
      className="relative"
    >
      {/* Connection Line */}
      {index < steps.length - 1 && (
        <div className="absolute left-1/2 top-20 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-zinc-800 via-zinc-700 to-transparent lg:block" />
      )}

      <div className="group relative">
        {/* Step Number */}
        <div className="absolute -left-2 -top-6 text-7xl font-bold text-zinc-900">
          {step.number}
        </div>

        {/* Card */}
        <div className="relative z-10 rounded-2xl bg-zinc-900/40 border border-zinc-800 p-6 transition-all duration-300 hover:border-zinc-700 hover:shadow-lg hover:shadow-primary-500/5">
          {/* Icon */}
          <div className={`mb-5 inline-flex rounded-xl bg-gradient-to-br ${step.color} p-3.5 shadow-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>

          {/* Content */}
          <h3 className="mb-2 text-lg font-semibold text-white">
            {step.title}
          </h3>
          <p className="text-sm text-zinc-500 leading-relaxed">
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
      {/* Background */}
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      <div className="absolute inset-0 bg-grid opacity-30" />

      <div className="container relative z-10">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl md:text-4xl font-bold text-white">
            How It Works
          </h2>
          <p className="text-lg text-zinc-400">
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

        {/* Demo/CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mt-20"
        >
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-800">
            <div className="aspect-video flex items-center justify-center">
              <div className="text-center px-4">
                <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
                  <FiZap className="h-10 w-10 text-white" />
                </div>
                <p className="text-lg font-medium text-white mb-4">
                  Ready to create your first game?
                </p>
                <a
                  href="/create"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-primary-600 to-secondary-600 text-white hover:shadow-lg hover:shadow-primary-500/25 transition-all"
                >
                  Start Creating
                  <FiArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
