import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),],

  build: {
    cssMinify: "esbuild",
  },

  server: {
    proxy: {
      "/api": {
        target:
          "http://localhost:8000",

        changeOrigin:
          false,
      },
    },
  },
});
