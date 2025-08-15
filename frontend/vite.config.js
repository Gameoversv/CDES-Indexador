import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // Permite acceso desde Windows
    watch: {
      usePolling: true, // Necesario para WSL
      interval: 100,
    },
    hmr: {
      port: 5173,
    },
  },
})
