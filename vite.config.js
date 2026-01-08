import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // '/api_jp'로 시작하면 일본 큐텐으로 연결
      '/api_jp': {
        target: 'https://api.qoo10.jp',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api_jp/, ''),
        secure: false,
      },
      // '/api_sg'로 시작하면 싱가포르 큐텐으로 연결
      '/api_sg': {
        target: 'https://api.qoo10.sg',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api_sg/, ''),
        secure: false,
      },
    },
  },
})