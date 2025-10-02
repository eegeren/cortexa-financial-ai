import { join } from 'path';

export default {
  content: [join(__dirname, 'index.html'), join(__dirname, 'src/**/*.{ts,tsx}')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        display: ['"Inter"', 'system-ui', 'sans-serif']
      },
      colors: {
        canvas: '#0E1117',
        surface: '#111827',
        muted: '#1F2933',
        outline: 'rgba(148, 163, 184, 0.35)',
        primary: '#7C3AED',
        accent: '#22D3EE',
        highlight: '#6366F1',
        ink: '#E2E8F0'
      },
      boxShadow: {
        elevation: '0 32px 60px rgba(8, 12, 20, 0.45)',
        'elevation-soft': '0 18px 40px rgba(12, 18, 28, 0.35)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.06)'
      },
      backgroundImage: {
        'grid-glow': 'radial-gradient(circle at 20% 20%, rgba(88, 28, 135, 0.18), transparent 55%), radial-gradient(circle at 80% 30%, rgba(14, 165, 233, 0.15), transparent 60%)',
        'glow-band': 'linear-gradient(135deg, rgba(124, 58, 237, 0.25) 0%, rgba(125, 211, 252, 0.25) 35%, transparent 70%)'
      }
    }
  },
  plugins: []
};
