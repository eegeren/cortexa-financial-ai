module.exports = {
  content: ['./src/**/*.{tsx,ts,jsx,js}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        surface: 'rgba(255,255,255,0.03)',
        border: 'rgba(255,255,255,0.07)',
        brand: '#1D9E75',
        'brand-dark': '#0F6E56',
        'brand-muted': 'rgba(29,158,117,0.15)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      backgroundColor: {
        dark: '#0a0a0a',
      }
    },
  },
  plugins: [],
}
