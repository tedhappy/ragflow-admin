import { defineConfig } from 'umi';

export default defineConfig({
  title: 'RAGFlow Admin',
  // Disable Umi UI plugins
  mfsu: false,
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: '@/pages/dashboard' },
    { path: '/datasets', component: '@/pages/datasets' },
    { path: '/chat', component: '@/pages/chat' },
    { path: '/agents', component: '@/pages/agents' },
    { path: '/settings', component: '@/pages/settings' },
  ],
  npmClient: 'npm',
  hash: true,
  history: {
    type: 'browser',
  },
  lessLoader: {
    modifyVars: {
      hack: `true; @import "~@/less/index.less";`,
    },
  },
  theme: {
    'primary-color': '#1677ff',
    'border-radius-base': '6px',
  },
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
});
