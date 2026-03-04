'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FiServer, FiDollarSign, FiAward, FiActivity } from 'react-icons/fi';

const statsData = [
  {
    label: 'Active Discord Servers',
    value: '5,000+',
    description: 'Communities creating games',
    icon: FiServer,
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    label: 'Credits Earned',
    value: '2.5M+',
    description: 'By creators worldwide',
    icon: FiDollarSign,
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    label: 'Achievements Unlocked',
    value: '100K+',
    description: 'Milestones reached',
    icon: FiAward,
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    label: 'Viral Coefficient',
    value: '1.35x',
    description: 'Average growth rate',
    icon: FiActivity,
    gradient: 'from-orange-500 to-red-500',
  },
];

function AnimatedCounter({ value }: { value: string }) {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.5, type: 'spring' }}
      className="text-3xl font-bold lg:text-4xl text-white"
    >
      {value}
    </motion.div>
  );
}

export function Stats() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <section className="py-20 lg:py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[oklch(var(--background))]" />
      <div className="absolute inset-0 bg-grid opacity-30" />

      <div className="container relative z-10">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="mb-4 text-3xl md:text-4xl font-bold text-white">
            Growing Fast, Together
          </h2>
          <p className="text-lg text-zinc-400">
            Join thousands of creators building the future of gaming
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statsData.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative overflow-hidden rounded-2xl bg-zinc-900/40 border border-zinc-800 p-6 transition-all duration-300 hover:border-zinc-700"
              >
                {/* Glow effect */}
                <div className={`absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-gradient-to-br ${stat.gradient} opacity-10 blur-3xl transition-transform duration-300 group-hover:scale-150`} />

                <div className={`relative mb-4 inline-flex rounded-xl p-3 bg-gradient-to-br ${stat.gradient}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>

                <AnimatedCounter value={stat.value} />

                <h3 className="mt-2 text-base font-semibold text-white">
                  {stat.label}
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  {stat.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
