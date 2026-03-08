'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiMaximize2, FiRefreshCw } from 'react-icons/fi';
import Link from 'next/link';
import { getGameById, GeneratedGame } from '@/lib/generation-store';

export default function GamePlayPage() {
  const params = useParams();
  const [game, setGame] = useState<GeneratedGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!params || !params.id) {
      setError('Invalid game ID');
      setLoading(false);
      return;
    }

    const id = params.id as string;

    const foundGame = getGameById(id);
    if (foundGame) {
      setGame(foundGame);
    } else {
      setError('Game not found. It may have been generated in a previous session.');
    }
    setLoading(false);
  }, [params]);

  const handleRestart = () => {
    setGameKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1425] flex items-center justify-center">
        <div className="text-white">Loading game...</div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-[#1a1425] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Game Not Found</h1>
          <p className="text-[#a89585] mb-6">{error || 'This game could not be loaded.'}</p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#ff6b35] to-[#f7c548] text-[#1a1425] rounded-xl font-medium"
          >
            Create New Game
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0a12]">
      {/* Header */}
      <div className="bg-[#1a1425] border-b border-[#5c4410] px-4 py-3">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-[#a89585] hover:text-[#ffd700] transition-colors"
            >
              <FiArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </Link>
            <div className="h-6 w-px bg-[#5c4410]" />
            <h1 className="text-lg font-semibold text-white">{game.title}</h1>
            <span className="px-2 py-0.5 bg-[#5c4410]/50 rounded-full text-xs text-[#ffd700] capitalize">
              {game.type.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#5c4410]/30 text-[#a89585] hover:text-[#ffd700] hover:bg-[#5c4410]/50 transition-colors"
            >
              <FiRefreshCw className="h-4 w-4" />
              Restart
            </button>
            <button
              onClick={() => document.documentElement.requestFullscreen?.()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#5c4410]/30 text-[#a89585] hover:text-[#ffd700] hover:bg-[#5c4410]/50 transition-colors"
            >
              <FiMaximize2 className="h-4 w-4" />
              Fullscreen
            </button>
          </div>
        </div>
      </div>

      {/* Game Container */}
      <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 60px)' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full max-w-5xl"
        >
          {/* Game iframe */}
          <div className="relative aspect-video bg-[#000] rounded-xl overflow-hidden border-2 border-[#5c4410]">
            <iframe
              key={gameKey}
              ref={iframeRef}
              srcDoc={game.code}
              className="w-full h-full"
              title={game.title}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>

          {/* Instructions */}
          <div className="mt-4 text-center text-[#a89585] text-sm">
            <p>Use arrow keys to move, space to shoot. If game doesn't load, try creating a new game.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
