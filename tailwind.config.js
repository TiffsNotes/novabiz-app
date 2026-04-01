/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        cab: ['Cabinet Grotesk', 'sans-serif'],
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        green: {
          DEFAULT: '#00a855',
          dark: '#007a3d',
          light: '#e8f8f0',
        },
      },
    },
  },
  plugins: [],
}
