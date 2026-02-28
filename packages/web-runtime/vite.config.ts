import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Base public path when served in development or production
  base: '/',
  
  // Development server configuration
  server: {
    port: 3001,
    host: true, // Allow external connections
    cors: true,
    headers: {
      // Required for Discord Activities
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          phaser: ['phaser'],
          discord: ['@discord/embedded-app-sdk']
        }
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000
  },
  
  // Environment variables
  define: {
    // Make environment variables available at build time
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    // Define global for Node.js compatibility
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  
  // Plugin configuration
  plugins: [],
  
  // Dependency optimization
  optimizeDeps: {
    include: [
      'phaser',
      '@discord/embedded-app-sdk'
    ],
    exclude: [
      '@gamevibe/shared'
    ]
  },
  
  // CSS configuration
  css: {
    devSourcemap: true
  },
  
  // Asset handling
  assetsInclude: [
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.gif',
    '**/*.svg',
    '**/*.webp',
    '**/*.mp3',
    '**/*.wav',
    '**/*.ogg',
    '**/*.json'
  ],
  
  // Worker configuration for potential future use
  worker: {
    format: 'es'
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../shared/src')
    }
  },
  
  // Preview server configuration (for built app)
  preview: {
    port: 3001,
    host: true,
    cors: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  }
});