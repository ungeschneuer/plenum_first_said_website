import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig({
  base: process.env.SITE_BASE || '/',
  plugins: [
    react(),
    tailwindcss(),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // Optimize chunks
    rollupOptions: {
      output: {
        // Vendor chunks - separate large dependencies
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor';
          }
          if (/[\\/]node_modules[\\/](chart\.js|react-chartjs-2|@kurkle)[\\/]/.test(id)) return 'chart-vendor';
          return undefined;
        },
      }
    },
    // Chunk size warning limit
    chunkSizeWarningLimit: 500,
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      }
    },
    // Source maps for debugging (disable in production)
    sourcemap: false,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  }
})
