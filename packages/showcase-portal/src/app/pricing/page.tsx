'use client';

import { motion } from 'framer-motion';
import { FiCheck, FiX, FiZap, FiStar, FiArrowRight, FiUsers, FiImage, FiDatabase, FiDownload, FiShield, FiHeadphones, FiBarChart2, FiServer, FiGlobe, FiLock } from 'react-icons/fi';
import Link from 'next/link';

const tiers = [
  {
    name: 'The Explorer',
    subtitle: 'Free Tier',
    idealFor: 'Beginners experimenting with game ideas and prototyping.',
    price: '$0',
    period: '/ Month',
    popular: false,
    features: [
      { name: 'The Squad', value: 'Lead Developer only (Basic game logic & physics)', included: true },
      { name: 'Assets', value: '50 AI-generated images/month (Standard Quality)', included: true },
      { name: 'Commercial Features', value: 'None (Gacha, Store, Monetization locked)', included: false },
      { name: 'Hosting', value: 'GameVibe URL (Includes watermark)', included: true },
      { name: 'Security', value: 'Cloud save (100 users for testing)', included: true },
    ],
  },
  {
    name: 'The Independent Director',
    subtitle: 'Pro Tier',
    idealFor: 'Solo Creators aiming to publish on stores and generate revenue.',
    price: '$29 - $39',
    period: '/ Month',
    popular: true,
    features: [
      { name: 'The Squad', value: 'Full team access (Lead Dev, Artist, Sound Director, Balancer)', included: true },
      { name: 'Assets', value: 'Unlimited images & audio (High Quality + Style Lock)', included: true },
      { name: 'Commercial Modules', value: 'Full access to Monetization Templates', included: true },
      { name: 'Security (BaaS)', value: 'Secure Backend & Database (5,000 DAU)', included: true },
      { name: 'Export', value: 'Remove watermarks; Export for Web (Itch.io)', included: true },
      { name: 'Storage', value: '10GB project files & assets', included: true },
    ],
  },
  {
    name: 'The Venture Studio',
    subtitle: 'Studio Tier',
    idealFor: 'Small teams or creators scaling games into a business.',
    price: '$99 - $129',
    period: '/ Month',
    popular: false,
    features: [
      { name: 'The Squad', value: 'Everything in Pro + Custom Agent Persona', included: true },
      { name: 'Multi-Agent', value: '"Agent Discussion" Mode for high-precision design', included: true },
      { name: 'Security (BaaS)', value: 'Enterprise backend (50,000 users) + Anti-Cheat', included: true },
      { name: 'Export', value: 'Multi-platform (iOS, Android, Steam)', included: true },
      { name: 'Priority Support', value: 'Direct human technical support', included: true },
      { name: 'Analytics', value: 'Deep-dive analytics on player behavior', included: true },
    ],
  },
  {
    name: 'Custom Build',
    subtitle: 'Enterprise',
    idealFor: 'Large corporations building custom gamification ecosystems.',
    price: 'Custom',
    period: ' Quote',
    popular: false,
    features: [
      { name: 'Server Infrastructure', value: 'Dedicated Server Infrastructure', included: true },
      { name: 'Branding', value: 'White-label (Full branding control)', included: true },
      { name: 'Deployment', value: 'On-premise deployment options', included: true },
      { name: 'Integrations', value: 'Custom internal API & 3rd-party software', included: true },
    ],
  },
];

function TierCard({ tier, index }: { tier: typeof tiers[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`relative rounded-2xl border-2 overflow-hidden ${
        tier.popular
          ? 'border-[#ffd700] bg-[#1a1425]'
          : 'border-[#5c4410] bg-[#1a1425]/60'
      }`}
    >
      {/* Popular Badge */}
      {tier.popular && (
        <div className="absolute top-0 left-0 right-0">
          <div className="bg-gradient-to-r from-[#ffd700] to-[#ffaa00] text-[#1a1425] text-center py-2 font-bold text-sm">
            ⭐ Recommended
          </div>
        </div>
      )}

      <div className={`p-6 ${tier.popular ? 'pt-14' : ''}`}>
        {/* Tier Name */}
        <div className="text-center mb-4">
          <h3 className="text-2xl font-bold text-white">{tier.name}</h3>
          <p className="text-sm text-[#ffd700] mt-1">{tier.subtitle}</p>
        </div>

        {/* Ideal For */}
        <p className="text-sm text-[#a89585] text-center mb-6">
          {tier.idealFor}
        </p>

        {/* Price */}
        <div className="text-center mb-8">
          <span className="text-4xl font-bold text-white">{tier.price}</span>
          <span className="text-[#a89585]">{tier.period}</span>
        </div>

        {/* Features */}
        <div className="space-y-3 mb-8">
          {tier.features.map((feature, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-xl ${
                feature.included ? 'bg-[#10b981]/10' : 'bg-[#1a1425]/40'
              }`}
            >
              {feature.included ? (
                <FiCheck className="h-5 w-5 text-[#10b981] shrink-0 mt-0.5" />
              ) : (
                <FiX className="h-5 w-5 text-[#a89585] shrink-0 mt-0.5" />
              )}
              <div className={feature.included ? 'text-white' : 'text-[#a89585]'}>
                <span className="font-medium text-sm">{feature.name}:</span>
                <span className="text-xs ml-1">{feature.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <Link
          href={tier.price === 'Custom' ? '/contact' : '/signup'}
          className={`block w-full py-3 rounded-xl font-medium text-center transition-all ${
            tier.popular
              ? 'bg-gradient-to-r from-[#ff6b35] to-[#f7c548] text-[#1a1425] hover:shadow-lg hover:shadow-[#ff6b35]/30'
              : 'border-2 border-[#5c4410] text-[#ffd700] hover:bg-[#5c4410]/30'
          }`}
        >
          {tier.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
          <FiArrowRight className="inline ml-2 h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1425] via-[#2d1f3d] to-[#1a1425] -z-10" />
      <div className="absolute inset-0 bg-grid opacity-20 -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#ff6b35]/5 rounded-full blur-[150px] -z-10" />

      <div className="container py-16">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#a89585] hover:text-[#ffd700] transition-colors mb-8"
        >
          <FiArrowRight className="h-4 w-4 rotate-180" />
          Back to Home
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            From <span className="gold-accent">Vibe</span> to <span className="gold-accent">Venture</span>
          </h1>
          <p className="text-xl text-[#a89585] max-w-2xl mx-auto">
            Choose the perfect plan to transform your game ideas into reality.
            Scale from curious Explorer to profitable Venture Studio.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {tiers.map((tier, index) => (
            <TierCard key={tier.name} tier={tier} index={index} />
          ))}
        </div>

        {/* Why This Works */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-20 max-w-4xl mx-auto"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Why This Works for GameVibe</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#1a1425]/60 border border-[#5c4410]">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f7c548] flex items-center justify-center mb-4">
                <FiZap className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Value-Based Scaling</h3>
              <p className="text-sm text-[#a89585]">
                You are not just paying for "more AI"—you are paying for more business capability (The Balancer, Anti-Cheat, and Secure BaaS).
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-[#1a1425]/60 border border-[#5c4410]">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#a78bfa] flex items-center justify-center mb-4">
                <FiUsers className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">The "Squad" Hook</h3>
              <p className="text-sm text-[#a89585]">
                Turns a technical subscription into a "hiring" experience—your own AI team of developers, artists, and sound directors.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-[#1a1425]/60 border border-[#5c4410]">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10b981] to-[#34d399] flex items-center justify-center mb-4">
                <FiBarChart2 className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Revenue Alignment</h3>
              <p className="text-sm text-[#a89585]">
                Tiers follow user growth from curious "Explorer" to profitable "Venture Studio."
              </p>
            </div>
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-20 max-w-3xl mx-auto"
        >
          <h2 className="text-3xl font-bold text-white text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I upgrade or downgrade anytime?',
                a: 'Yes! You can change your plan at any time. Upgrades take effect immediately, and downgrades apply at the next billing cycle.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, PayPal, and crypto for Enterprise plans.',
              },
              {
                q: 'Is there a free trial?',
                a: 'The Free tier gives you unlimited access to The Lead Developer. Pro and Studio tiers come with a 14-day money-back guarantee.',
              },
              {
                q: 'What happens to my games if I downgrade?',
                a: 'Your games remain playable, but you may lose access to premium features. You can always export your code before downgrading.',
              },
            ].map((faq, i) => (
              <div
                key={i}
                className="p-5 rounded-xl bg-[#1a1425]/60 border border-[#5c4410]"
              >
                <h3 className="font-bold text-white mb-2">{faq.q}</h3>
                <p className="text-sm text-[#a89585]">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
