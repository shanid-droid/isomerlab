/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'eg': {
          DEFAULT: '#00ff88',
          50:  '#e6fff3',
          100: '#b3ffe0',
          200: '#66ffbb',
          300: '#00ff88',
          400: '#00cc6a',
          500: '#009950',
          600: '#006635',
          700: '#00331a',
        },
        'dark': {
          DEFAULT: '#080c0a',
          100: '#0d120f',
          200: '#121a15',
          300: '#1a261e',
          400: '#243328',
          500: '#2e4033',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)",
        'radial-eg': 'radial-gradient(ellipse at center, rgba(0,255,136,0.08) 0%, transparent 70%)',
      },
      backgroundSize: {
        'grid': '60px 60px',
      },
      boxShadow: {
        'eg-sm':  '0 0 8px rgba(0,255,136,0.25)',
        'eg':     '0 0 20px rgba(0,255,136,0.3)',
        'eg-lg':  '0 0 40px rgba(0,255,136,0.2)',
        'eg-xl':  '0 0 60px rgba(0,255,136,0.15)',
        'card':   '0 4px 32px rgba(0,0,0,0.6)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow':  'spin 8s linear infinite',
        'float':      'float 6s ease-in-out infinite',
        'scan':       'scan 3s linear infinite',
        'glitch':     'glitch 2s steps(1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        glitch: {
          '0%, 90%, 100%': { transform: 'translate(0)' },
          '92%':           { transform: 'translate(-2px, 1px)' },
          '94%':           { transform: 'translate(2px, -1px)' },
          '96%':           { transform: 'translate(-1px, 2px)' },
          '98%':           { transform: 'translate(1px, -2px)' },
        },
      },
      borderColor: {
        'eg-subtle': 'rgba(0,255,136,0.15)',
        'eg-glow':   'rgba(0,255,136,0.4)',
      },
    },
  },
  plugins: [],
}
