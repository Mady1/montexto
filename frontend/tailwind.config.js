/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef0fe',
          100: '#e0e3fd',
          200: '#c5cafb',
          300: '#a3aaf8',
          400: '#818cf5',
          500: '#5b6cf9',
          600: '#3d4de0',
          700: '#333fb8',
          800: '#2a3494',
          900: '#232b78',
        },
        gem: {
          purple: '#9b6cf9',
          pink: '#f96c9b',
          teal: '#0d9488',
          amber: '#f9ab00',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'xl': '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
    },
  },
  plugins: [],
}
