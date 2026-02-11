/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep forest green palette
        ink: {
          50: '#f4f7f6',
          100: '#e3ebe8',
          200: '#c7d7d1',
          300: '#a3bdb3',
          400: '#7a9e91',
          500: '#5a8274',
          600: '#47695d',
          700: '#3b564d',
          800: '#324740',
          900: '#2b3c36',
          950: '#16211e',
        },
        // Warm white
        paper: {
          50: '#fefdfb',
          100: '#fbf9f5',
          200: '#f7f3eb',
          300: '#f0e9dc',
          400: '#e5d9c5',
        },
        // Status colors
        status: {
          pass: '#10b981',      // Emerald
          warning: '#f59e0b',   // Amber
          fail: '#ef4444',      // Rose
          info: '#3b82f6',      // Blue
        }
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
