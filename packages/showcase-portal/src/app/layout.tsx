import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import { Providers } from '@/components/providers';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: {
    default: 'GameVibe AI - Create & Play AI-Generated Games',
    template: '%s | GameVibe AI',
  },
  description: 'Discover and play amazing games created by AI. Join thousands of creators making unique gaming experiences with natural language.',
  keywords: ['AI games', 'game creation', 'Discord games', 'AI-generated games', 'play online games'],
  authors: [{ name: 'GameVibe Team' }],
  creator: 'GameVibe AI',
  publisher: 'GameVibe AI',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://gamevibe.ai',
    siteName: 'GameVibe AI',
    title: 'GameVibe AI - Create & Play AI-Generated Games',
    description: 'Discover and play amazing games created by AI. Join thousands of creators making unique gaming experiences.',
    images: [
      {
        url: 'https://gamevibe.ai/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GameVibe AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GameVibe AI - Create & Play AI-Generated Games',
    description: 'Discover and play amazing games created by AI.',
    images: ['https://gamevibe.ai/twitter-image.png'],
    creator: '@gamevibe_ai',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
          <Toaster position="bottom-right" />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}