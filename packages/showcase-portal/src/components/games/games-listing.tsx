'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, type Game } from '@/lib/api-client';

export function GamesListing() {
  const [page, setPage] = useState(1);
  const [gameType, setGameType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'trending'>('recent');

  const { data, isLoading, error } = useQuery({
    queryKey: ['games', page, gameType, sortBy],
    queryFn: async () => {
      return apiClient.getAllGames({
        page,
        limit: 12,
        ...(gameType !== 'all' && { type: gameType }),
        sort: sortBy,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold mb-8 text-center">Discover Games</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="w-full h-48 bg-gray-700 rounded mb-4"></div>
              <div className="h-6 bg-gray-700 rounded mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 text-center py-12">
        <h2 className="text-2xl font-bold text-red-500 mb-4">Error loading games</h2>
        <p className="text-gray-400">Please try again later.</p>
      </div>
    );
  }

  const games = data?.games || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-4xl font-bold mb-8 text-center">Discover Games</h1>
      
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8 justify-center">
        <select
          value={gameType}
          onChange={(e) => setGameType(e.target.value)}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="platformer">Platformer</option>
          <option value="puzzle">Puzzle</option>
          <option value="shooter">Shooter</option>
          <option value="endless-runner">Endless Runner</option>
          <option value="adventure">Adventure</option>
        </select>
        
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
        >
          <option value="recent">Most Recent</option>
          <option value="popular">Most Popular</option>
          <option value="trending">Trending</option>
        </select>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {games.map((game) => (
          <div key={game.id} className="bg-gray-800 rounded-lg overflow-hidden hover:transform hover:scale-105 transition-transform duration-200">
            <div className="aspect-video bg-gray-700 relative">
              {game.thumbnailUrl ? (
                <img
                  src={game.thumbnailUrl}
                  alt={game.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              <div className="absolute top-2 right-2 bg-black bg-opacity-75 px-2 py-1 rounded text-sm">
                {game.type}
              </div>
            </div>
            
            <div className="p-4">
              <h3 className="font-bold text-lg mb-2 line-clamp-1">{game.title}</h3>
              <p className="text-gray-400 text-sm mb-3 line-clamp-2">{game.description}</p>
              
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>by {game.creatorName || 'Unknown'}</span>
                <span>{game.plays} plays</span>
              </div>
              
              <a
                href={`/play/${game.id}`}
                className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 block text-center"
              >
                Play Now
              </a>
            </div>
          </div>
        ))}
      </div>

      {games.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No games found. Try adjusting your filters.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8 gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
          >
            Previous
          </button>
          
          <span className="px-4 py-2 text-gray-400">
            Page {page} of {totalPages}
          </span>
          
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}