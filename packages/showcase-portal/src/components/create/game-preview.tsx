'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlay, FiRefreshCw, FiCode, FiCheck, FiZap, FiEdit3, FiShare2, FiCopy, FiX, FiTwitter, FiMessageCircle, FiExternalLink } from 'react-icons/fi';
import { useGenerationStore } from '@/lib/generation-store';
import toast from 'react-hot-toast';

export function GamePreview() {
  const { status, generatedGame, reset, setPrompt, error, errorType } = useGenerationStore();
  const [showCode, setShowCode] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handlePlayGame = () => {
    if (generatedGame) {
      const gameUrl = `/games/${generatedGame.id}`;
      window.open(gameUrl, '_blank');
    }
  };

  const handleRemixGame = () => {
    if (generatedGame) {
      const remixPrompt = `Remix of ${generatedGame.title}: ${generatedGame.description}`;
      setPrompt(remixPrompt);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success('Prompt loaded! Modify it to create your remix.');
    }
  };

  const handleCopyCode = async () => {
    if (generatedGame) {
      try {
        await navigator.clipboard.writeText(generatedGame.code);
        setCopiedCode(true);
        toast.success('Code copied to clipboard!');
        setTimeout(() => setCopiedCode(false), 2000);
      } catch {
        toast.error('Failed to copy code');
      }
    }
  };

  const handleCopyUrl = async () => {
    if (generatedGame) {
      try {
        const url = `${window.location.origin}/games/${generatedGame.id}`;
        await navigator.clipboard.writeText(url);
        setCopiedUrl(true);
        toast.success('Game URL copied to clipboard!');
        setTimeout(() => setCopiedUrl(false), 2000);
      } catch {
        toast.error('Failed to copy URL');
      }
    }
  };

  const handleShareTwitter = () => {
    if (generatedGame) {
      const text = encodeURIComponent(`Check out "${generatedGame.title}" - created with GameVibe AI!`);
      const url = `${window.location.origin}/games/${generatedGame.id}`;
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`, '_blank');
    }
  };

  const handleShareDiscord = () => {
    if (generatedGame) {
      const url = `${window.location.origin}/games/${generatedGame.id}`;
      void navigator.clipboard.writeText(`**${generatedGame.title}**\n${generatedGame.description}\n\nPlay it here: ${url}`);
      toast.success('Discord share text copied! Paste it in your server.');
    }
  };

  if (status === 'idle' || status === 'analyzing' || status === 'generating' || status === 'building') {
    return null;
  }

  if (status === 'error') {
    const getErrorMessage = () => {
      switch (errorType) {
        case 'network':
          return 'Network error. Please check your connection and try again.';
        case 'rate_limit':
          return 'Rate limit exceeded. Please wait a moment before trying again.';
        case 'validation':
          return 'Invalid prompt. Please ensure your game description meets the requirements.';
        default:
          return error || 'There was an error generating your game. Please try again.';
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl mx-auto mt-8"
      >
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
          <h3 className="text-lg font-semibold text-red-400 mb-2">
            Failed to generate game
          </h3>
          <p className="text-zinc-400 mb-4">
            {getErrorMessage()}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
            >
              <FiRefreshCw className="h-4 w-4" />
              Try Again
            </button>
            {errorType === 'validation' && (
              <button
                onClick={() => setPrompt('')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Clear & Start Over
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  if (status === 'complete' && generatedGame) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl mx-auto mt-8"
      >
        {/* Success Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-3 mb-6"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30">
            <FiCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <span className="text-xl font-semibold text-white">
            Game Ready!
          </span>
        </motion.div>

        {/* Game Preview Card */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Preview Frame */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="relative"
          >
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700">
              {/* Game Preview */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-28 h-28 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 via-secondary-500 to-purple-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
                    <FiZap className="h-14 w-14 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {generatedGame.title}
                  </h3>
                  <p className="text-zinc-400">
                    {generatedGame.description}
                  </p>
                </div>
              </div>

              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity duration-300">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePlayGame}
                  className="flex items-center gap-2 px-8 py-4 bg-white text-zinc-900 rounded-full font-semibold shadow-xl cursor-pointer"
                >
                  <FiPlay className="h-6 w-6" />
                  Play Now
                </motion.button>
              </div>

              {/* Game Type Badge */}
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-zinc-900/80 backdrop-blur-sm rounded-full text-xs font-medium text-zinc-300 border border-zinc-700">
                {generatedGame.type.replace('_', ' ')}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handlePlayGame}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium bg-gradient-to-r from-primary-600 to-secondary-600 text-white hover:shadow-lg hover:shadow-primary-500/25 transition-all cursor-pointer"
              >
                <FiPlay className="h-5 w-5" />
                Play Game
              </button>
              <button
                onClick={() => setShowCode(!showCode)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 transition-all cursor-pointer"
              >
                <FiCode className="h-5 w-5" />
                {showCode ? 'Hide Code' : 'View Code'}
              </button>
            </div>
          </motion.div>

          {/* Game Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <h3 className="font-semibold text-lg text-white mb-4">Game Details</h3>
              <dl className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <dt className="text-zinc-500">Title</dt>
                  <dd className="font-medium text-white">{generatedGame.title}</dd>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <dt className="text-zinc-500">Type</dt>
                  <dd className="font-medium text-white capitalize">{generatedGame.type.replace('_', ' ')}</dd>
                </div>
                <div className="flex justify-between items-center py-2">
                  <dt className="text-zinc-500">Status</dt>
                  <dd className="font-medium text-emerald-400 flex items-center gap-1.5">
                    <FiCheck className="h-4 w-4" />
                    Ready to play
                  </dd>
                </div>
              </dl>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleRemixGame}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 transition-all cursor-pointer"
              >
                <FiEdit3 className="h-4 w-4" />
                Remix Game
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 transition-all cursor-pointer"
              >
                <FiShare2 className="h-4 w-4" />
                Share
              </button>
            </div>

            {/* Create Another */}
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium border-2 border-dashed border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 transition-all cursor-pointer"
            >
              <FiZap className="h-4 w-4" />
              Create Another Game
            </button>
          </motion.div>
        </div>

        {/* Code Preview */}
        <AnimatePresence>
          {showCode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6"
            >
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-zinc-400">Generated Code</span>
                  <button
                    onClick={() => void handleCopyCode()}
                    className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <FiCheck className="h-3 w-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <FiCopy className="h-3 w-3" />
                        Copy Code
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs text-zinc-400 font-mono overflow-x-auto max-h-64">
                  {generatedGame.code.slice(0, 2000)}
                  {generatedGame.code.length > 2000 && '\n\n... (truncated)'}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share Modal */}
        <AnimatePresence>
          {showShareModal && generatedGame && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowShareModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-2xl"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Share Game</h3>
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="p-2 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <FiX className="h-5 w-5 text-zinc-400" />
                  </button>
                </div>

                {/* Game Preview */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 mb-6">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                    <FiZap className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{generatedGame.title}</h4>
                    <p className="text-sm text-zinc-500">{generatedGame.type.replace('_', ' ')}</p>
                  </div>
                </div>

                {/* Share URL */}
                <div className="mb-6">
                  <label className="text-sm font-medium text-zinc-400 mb-2 block">Game Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/games/${generatedGame.id}`}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-300"
                    />
                    <button
                      onClick={() => void handleCopyUrl()}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors cursor-pointer"
                    >
                      {copiedUrl ? <FiCheck className="h-4 w-4" /> : <FiCopy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Social Share Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleShareTwitter}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl font-medium bg-[#1DA1F2] text-white hover:bg-[#1a91da] transition-colors cursor-pointer"
                  >
                    <FiTwitter className="h-5 w-5" />
                    Twitter
                  </button>
                  <button
                    onClick={handleShareDiscord}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl font-medium bg-[#5865F2] text-white hover:bg-[#4752c4] transition-colors cursor-pointer"
                  >
                    <FiMessageCircle className="h-5 w-5" />
                    Discord
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return null;
}
