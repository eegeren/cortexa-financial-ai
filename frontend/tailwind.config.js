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
        canvas: '#0D0D0D',
        surface: '#151515',
        muted: '#1E1E1E',
        outline: 'rgba(255, 255, 255, 0.08)',
        primary: '#10A37F',
        accent: '#2B7CFF',
        highlight: '#1F7A68',
        ink: '#F4F4F5'
      },
      boxShadow: {
        elevation: '0 28px 48px rgba(0, 0, 0, 0.5)',
        'elevation-soft': '0 16px 32px rgba(0, 0, 0, 0.4)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.04)'
      },
      backgroundImage: {
        'grid-glow': 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.06), transparent 60%)',
        'glow-band': 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, transparent 60%)'
      }
    }
  },
  plugins: []
};
