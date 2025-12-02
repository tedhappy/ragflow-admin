import { defineConfig } from 'umi';

export default defineConfig({
  title: 'RAGFlow Admin',
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: '@/pages/dashboard' },
    { path: '/datasets', component: '@/pages/datasets' },
    { path: '/chat', component: '@/pages/chat' },
    { path: '/agents', component: '@/pages/agents' },
    { path: '/settings', component: '@/pages/settings' },
  ],
  npmClient: 'npm',
  tailwindcss: {},
  plugins: ['@umijs/plugins/dist/tailwindcss'],
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
});
