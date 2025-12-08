import { defineConfig } from 'umi';

export default defineConfig({
  title: 'RAGFlow Admin',
  links: [
    { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' },
  ],
  // Disable Umi UI plugins
  mfsu: false,
  routes: [
    { path: '/login', component: '@/pages/login' },
    { 
      path: '/',
      component: '@/layouts/BasicLayout',
      wrappers: ['@/wrappers/auth'],
      routes: [
        { path: '/', redirect: '/dashboard' },
        { path: '/dashboard', component: '@/pages/dashboard' },
        { path: '/datasets', component: '@/pages/datasets' },
        { path: '/datasets/:datasetId/documents', component: '@/pages/documents' },
        { path: '/chat', component: '@/pages/chat' },
        { path: '/agents', component: '@/pages/agents' },
        { path: '/users', component: '@/pages/users' },
        { path: '/settings', component: '@/pages/settings' },
      ],
    },
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
