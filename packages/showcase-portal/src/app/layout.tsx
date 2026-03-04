import { Analytics } from '@vercel/analytics/react';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './globals.css';
import { Providers } from '@/components/providers';
import { ThemeProvider } from '@/components/theme-provider';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Toaster } from 'react-hot-toast';

export const metadata = {
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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[oklch(var(--background))] text-[oklch(var(--foreground))] antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <Providers>
            {/* Skip to main content link for accessibility */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:mx-auto focus:w-full focus:rounded-md focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
            >
              Skip to main content
            </a>

            <div className="flex min-h-screen flex-col">
              <Header />
              <main id="main-content" className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
            <Toaster position="bottom-right" />
          </Providers>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
