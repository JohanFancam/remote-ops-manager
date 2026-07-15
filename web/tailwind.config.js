/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#05080f',
          900: '#0a1220',
          800: '#101c30',
          700: '#1a2a45',
          600: '#243656',
        },
        lime: {
          DEFAULT: '#c8f531',
          dim: '#9fc41f',
          glow: '#d9ff5c',
        },
        mist: {
          DEFAULT: '#c5d0e0',
          muted: '#8a9bb3',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        cue: '0 0 0 1px rgba(200,245,49,0.18)',
      },
      minHeight: {
        dvh: '100dvh',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        phaseFlash: {
          '0%': { backgroundColor: 'rgba(200,245,49,0.35)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 1.6s ease-in-out infinite',
        'rise-in': 'riseIn 0.45s ease-out both',
        'phase-flash': 'phaseFlash 0.7s ease-out',
      },
    },
  },
  plugins: [],
};
