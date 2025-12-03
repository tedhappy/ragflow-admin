/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.tsx',
    './src/components/**/*.tsx',
    './src/layouts/**/*.tsx',
  ],
  theme: {
    extend: {
      colors: {
        // RAGFlow Admin color scheme
        primary: {
          DEFAULT: '#1677ff',
          50: '#e6f4ff',
          100: '#bae0ff',
          200: '#91caff',
          300: '#69b1ff',
          400: '#4096ff',
          500: '#1677ff',
          600: '#0958d9',
          700: '#003eb3',
          800: '#002c8c',
          900: '#001d66',
        },
        // Layout colors
        layout: {
          bg: '#f5f7fa',
          sider: '#ffffff',
        },
        // Text colors
        text: {
          primary: 'rgba(0, 0, 0, 0.88)',
          secondary: 'rgba(0, 0, 0, 0.65)',
          tertiary: 'rgba(0, 0, 0, 0.45)',
          disabled: 'rgba(0, 0, 0, 0.25)',
        },
        // Border colors
        border: {
          DEFAULT: '#d9d9d9',
          light: '#f0f0f0',
        },
        // Status colors
        success: '#52c41a',
        warning: '#faad14',
        error: '#ff4d4f',
        info: '#1677ff',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
        ],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
        dropdown: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false, // Avoid conflicts with Ant Design
  },
};
