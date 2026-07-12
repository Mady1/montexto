/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          50: 'rgb(var(--gray-50) / <alpha-value>)',
          100: 'rgb(var(--gray-100) / <alpha-value>)',
          200: 'rgb(var(--gray-200) / <alpha-value>)',
          300: 'rgb(var(--gray-300) / <alpha-value>)',
          400: 'rgb(var(--gray-400) / <alpha-value>)',
          500: 'rgb(var(--gray-500) / <alpha-value>)',
          600: 'rgb(var(--gray-600) / <alpha-value>)',
          700: 'rgb(var(--gray-700) / <alpha-value>)',
          800: 'rgb(var(--gray-800) / <alpha-value>)',
          900: 'rgb(var(--gray-900) / <alpha-value>)',
        },
        red: {
          50: 'var(--red-50)', 100: 'var(--red-100)', 200: 'var(--red-200)',
          400: 'var(--red-400)', 500: 'var(--red-500)', 600: 'var(--red-600)',
        },
        green: {
          50: 'var(--green-50)', 400: 'var(--green-400)', 500: 'var(--green-500)', 600: 'var(--green-600)',
        },
        emerald: {
          50: 'var(--emerald-50)', 100: 'var(--emerald-100)',
          500: 'var(--emerald-500)', 600: 'var(--emerald-600)', 700: 'var(--emerald-700)',
        },
        amber: {
          50: 'var(--amber-50)', 100: 'var(--amber-100)',
          500: 'var(--amber-500)', 600: 'var(--amber-600)', 700: 'var(--amber-700)',
        },
        blue: {
          50: 'var(--blue-50)', 500: 'var(--blue-500)', 600: 'var(--blue-600)',
        },
        orange: {
          50: 'var(--orange-50)', 400: 'var(--orange-400)', 600: 'var(--orange-600)',
        },
        purple: {
          50: 'var(--purple-50)', 600: 'var(--purple-600)',
        },
        brand: {
          50: '#eaf6f4',
          100: '#d2ece8',
          200: '#a7dad2',
          300: '#78c2b7',
          400: '#43a99b',
          500: '#0e7c74',
          600: '#0b645e',
          700: '#0a5450',
          800: '#094542',
          900: '#073b38',
        },
        gem: {
          purple: '#7b5ca6',
          pink: '#c1577a',
          teal: '#2f8577',
          amber: '#b57922',
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
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
