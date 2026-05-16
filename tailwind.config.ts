import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#d4af37',
          dim: '#a68929',
          light: '#e8c84a',
        },
        board: {
          green: '#2d5a3d',
          grid: '#4a7c59',
        },
        stone: {
          black: '#0f0f0f',
          white: '#f0f0f0',
        },
      },
      fontFamily: {
        sans: ['Noto Sans JP', 'sans-serif'],
        display: ['Cinzel', 'serif'],
      },
      backgroundImage: {
        'page-gradient': `
          radial-gradient(ellipse at 20% 80%, rgba(45, 90, 61, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(22, 33, 62, 0.8) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(212, 175, 55, 0.03) 0%, transparent 70%)
        `,
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'pulse-slow': 'pulse 1.5s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'scale-in': 'scaleIn 0.3s ease-out',
        'spin-slow': 'spin 1s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(212, 175, 55, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(212, 175, 55, 0.6)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.9)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'card': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 12px 48px rgba(0, 0, 0, 0.5)',
        'gold': '0 8px 24px rgba(212, 175, 55, 0.3)',
        'gold-lg': '0 0 30px rgba(212, 175, 55, 0.2)',
      },
    },
  },
  plugins: [],
} satisfies Config
