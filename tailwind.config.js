/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vault: {
          bg: '#0f1115',
          panel: '#171a21',
          panel2: '#1e222b',
          border: '#2a2f3a',
          accent: '#4f8cff',
          accent2: '#6ee7b7',
          muted: '#8b93a7',
          text: '#e6e9ef',
        },
      },
    },
  },
  plugins: [],
};
