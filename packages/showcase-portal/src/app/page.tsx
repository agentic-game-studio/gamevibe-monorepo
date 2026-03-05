import { Hero } from '@/components/home/hero';
import { TrendingGames } from '@/components/home/trending-games';
import { HowItWorks } from '@/components/home/how-it-works';
import { CallToAction } from '@/components/home/call-to-action';

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrendingGames />
      <HowItWorks />
      <CallToAction />
    </>
  );
}