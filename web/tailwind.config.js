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
        // RAGFlow 配色
        primary: {
          DEFAULT: '#1677ff',
          50: '#e6f4ff',
          100: '#bae0ff',
          500: '#1677ff',
          600: '#0958d9',
        },
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false, // 避免与antd冲突
  },
};
