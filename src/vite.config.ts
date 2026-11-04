import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // プラグインの島（../plugins/<id>/island.tsx）は画面の SDK を @plugin-sdk で使う
    alias: { '@plugin-sdk': fileURLToPath(new URL('./src/plugin-sdk/index.ts', import.meta.url)) },
    // plugins/ は src/ の外にあるので、React と three は画面と同じもの（src/node_modules）を使わせる
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
  },
  server: {
    host: true,
    // 開発サーバーは plugins/ の島も配る。フォルダを足すと再起動せずに読み込まれる
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
})
