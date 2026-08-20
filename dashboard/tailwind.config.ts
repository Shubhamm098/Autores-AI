import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        primary: { DEFAULT: '#6366f1', dark: '#4f46e5' },
        accent: '#8b5cf6',
        surface: { DEFAULT: '#111827', secondary: '#0e1221', card: '#162035' },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease forwards',
        'pulse-glow': 'pulse-glow 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
        blink: 'blink 1.5s infinite',
      },
      keyframes: {
        'slide-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0.3)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(99,102,241,0.3)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
