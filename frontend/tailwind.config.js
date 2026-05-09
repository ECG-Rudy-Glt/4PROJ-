/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          // Mode clair : vert foncé sur fond blanc
          // Mode sombre : vert clair sur fond noir
          50: '#ebf5eb',
          100: '#d6ebd6',
          200: '#adcbad',
          300: '#84ac84',
          400: '#679467',
          500: '#4a7c4a',
          600: '#2d5a27',  // Vert forêt profond
          700: '#244820',
          800: '#1b3618',
          900: '#122410',
        },
        accent: {
          warm: {
            light: '#D4785C',    // Terre cuite - light mode
            dark: '#E8A088',     // Plus clair - dark mode
          },
          bright: {
            light: '#E8B84A',    // Moutarde doré - light mode
            dark: '#F0C96B',     // Plus clair - dark mode
          },
        },
        neutral: {
          light: '#F5F3EF',      // Blanc cassé
          dark: '#2D2D2D',       // Gris anthracite
        },
      },
      backgroundColor: {
        'primary-light': '#FFFFFF',
        'primary-dark': '#1a1a1a',
        'secondary-light': '#F5F3EF',
        'secondary-dark': '#2D2D2D',
      },
    },
  },
  plugins: [],
}
