import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH ?? '/';

  return {
    base,
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_PORT ?? 5173),
      open: true
    },
    resolve: {
      alias: {
        '@': '/src'
      }
    }
  };
});
