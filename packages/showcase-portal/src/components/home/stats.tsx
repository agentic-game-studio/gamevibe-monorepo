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
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
  },
  {
    label: 'Credits Earned',
    value: '2.5M+',
    description: 'By creators worldwide',
    icon: FiDollarSign,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/20',
  },
  {
    label: 'Achievements Unlocked',
    value: '100K+',
    description: 'Milestones reached',
    icon: FiAward,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/20',
  },
  {
    label: 'Viral Coefficient',
    value: '1.35x',
    description: 'Average growth rate',
    icon: FiActivity,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/20',
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
      className="text-3xl font-bold lg:text-4xl"
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
    <section className="py-20 lg:py-24">
      <div className="container">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white lg:text-4xl">
            Growing Fast, Together
          </h2>
          <p className="mb-12 text-lg text-gray-600 dark:text-gray-300">
            Join thousands of creators building the future of gaming
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {statsData.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-lg transition-all duration-300 hover:shadow-2xl dark:bg-gray-800"
              >
                <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 transform rounded-full bg-gradient-to-br from-primary-500/10 to-secondary-500/10 blur-2xl transition-transform duration-300 group-hover:scale-150" />
                
                <div className={`mb-4 inline-flex rounded-lg p-3 ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                
                <AnimatedCounter value={stat.value} />
                
                <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {stat.label}
                </h3>
                
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
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