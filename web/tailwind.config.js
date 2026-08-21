/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070b14',
          900: '#0c1424',
          800: '#132038',
          700: '#1c2f4d',
          600: '#2a4066',
        },
        blue: {
          DEFAULT: '#3b82f6',
          bright: '#60a5fa',
          deep: '#2563eb',
          soft: 'rgba(59,130,246,0.15)',
        },
        mist: {
          DEFAULT: '#c9d4e8',
          muted: '#8b9bb8',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      minHeight: { dvh: '100dvh' },
      keyframes: {
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'rise-in': 'riseIn 0.4s ease-out both',
        'pulse-soft': 'pulseSoft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
