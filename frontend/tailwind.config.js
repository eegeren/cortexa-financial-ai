import { join } from 'path';

export default {
  content: [join(__dirname, 'index.html'), join(__dirname, 'src/**/*.{ts,tsx}')],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        accent: '#22d3ee'
      }
    }
  },
  plugins: []
};
