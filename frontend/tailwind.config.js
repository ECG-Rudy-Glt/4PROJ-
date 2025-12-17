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
          50: '#e6f2f1',   // Très clair - parfait pour dark mode
          100: '#b3dbd8',  // Clair - bien pour dark mode
          200: '#80c4be',  // Moyen clair - hover en dark mode
          300: '#5A9A94',  // Vert menthe doux - principal en dark mode
          400: '#478078',  // Moyen
          500: '#3A6B66',  // Vert sauge - hover en light mode
          600: '#254441',  // Vert-bleu profond - principal en light mode
          700: '#1d3633',  // Foncé
          800: '#162826',  // Très foncé
          900: '#0f1a19',  // Ultra foncé
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
