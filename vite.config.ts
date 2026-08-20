import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@nivo')) return 'vendor-nivo'
          if (id.includes('d3-') || id.includes('d3/')) return 'vendor-d3'
          if (id.includes('motion') || id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('@radix-ui')) return 'vendor-radix'
          if (id.includes('@tanstack')) return 'vendor-tanstack'
        },
      },
    },
  },
})
