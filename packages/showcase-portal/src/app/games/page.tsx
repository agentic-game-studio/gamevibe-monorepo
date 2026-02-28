import { GamesListing } from '@/components/games/games-listing';

export const metadata = {
  title: 'Browse Games',
  description: 'Discover and play amazing AI-generated games created by the GameVibe community.',
};

export default function GamesPage() {
  return (
    <div className="min-h-screen py-12">
      <GamesListing />
    </div>
  );
}
