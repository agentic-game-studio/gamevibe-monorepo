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
    color: 'from-green-500 to-emerald-500',
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
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.5, delay: index * 0.2 }}
      className="relative"
    >
      {/* Connection Line */}
      {index < steps.length - 1 && (
        <div className="absolute left-1/2 top-24 hidden h-full w-0.5 -translate-x-1/2 bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-700 lg:block" />
      )}

      <div className="group relative">
        {/* Step Number */}
        <div className="absolute -left-4 -top-4 text-6xl font-bold text-gray-100 dark:text-gray-800">
          {step.number}
        </div>

        {/* Card */}
        <div className="relative z-10 rounded-2xl bg-white p-8 shadow-lg transition-all duration-300 hover:shadow-2xl dark:bg-gray-800">
          {/* Icon */}
          <div className={`mb-6 inline-flex rounded-xl bg-gradient-to-br ${step.color} p-4 text-white shadow-lg`}>
            <Icon className="h-8 w-8" />
          </div>

          {/* Content */}
          <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">
            {step.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {step.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section className="py-20 lg:py-24">
      <div className="container">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
            How It Works
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            From idea to playable game in minutes
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 lg:grid-cols-4 lg:gap-8">
            {steps.map((step, index) => (
              <StepCard key={step.number} step={step} index={index} />
            ))}
          </div>
        </div>

        {/* Demo Video Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mt-20"
        >
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/20 dark:to-secondary-900/20">
            <div className="aspect-video flex items-center justify-center">
              <div className="text-center">
                <FiPlay className="mx-auto mb-4 h-16 w-16 text-primary-600 dark:text-primary-400" />
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                  Watch a 2-minute demo
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}