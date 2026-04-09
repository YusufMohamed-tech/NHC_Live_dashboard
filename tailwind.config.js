/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cairo', 'sans-serif'],
        body: ['Tajawal', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

