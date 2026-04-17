/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#059669',
          600: '#047857',
          700: '#065f46',
          800: '#064e3b',
          900: '#022c22',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Noto Sans JP"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
