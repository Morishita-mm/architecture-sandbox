import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { securityHeaders } from './securityHeaders'

export default defineConfig(({ command, mode }) => {
  const envDir = path.resolve(__dirname, '..')
  const env = { ...loadEnv(mode, envDir, 'VITE_'), ...process.env }
  if (command === 'build') {
    const url = new URL(env.VITE_API_BASE_URL || 'invalid:')
    const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    const isLocal = mode === 'development' && isLoopback && url.protocol === 'http:'
    if ((!isLocal && (url.protocol !== 'https:' || isLoopback)) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('Set VITE_API_BASE_URL to the HTTPS Cloud Run origin (use --mode development for a local smoke build).')
    }
  }
  return {
    plugins: [react(), {
      name: 'production-security-headers',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: '_headers', source: securityHeaders(new URL(env.VITE_API_BASE_URL!).origin) })
      },
    }],
    envDir,
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  }
})
