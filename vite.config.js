import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // relative asset paths — works at any URL (GitHub Pages subpath included)
  plugins: [react()],
  server: { port: 5174 },
})
