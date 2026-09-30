import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // strictPort: the backend's CORS_ORIGINS allows :5173, so fail loudly instead of drifting to :5174.
  server: { port: 5173, strictPort: true },
})
