/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wood: {
          light: '#8B5A2B',
          DEFAULT: '#5C4033', // ពណ៌ឈើចម្បង
          dark: '#3E2723',    // ពណ៌ឈើចាស់
        },
        khmerGold: {
          light: '#F3E5AB',
          DEFAULT: '#D4AF37', // ពណ៌មាសក្បាច់ខ្មែរ
        },
        ecoGreen: {
          DEFAULT: '#2E8B57', // ពណ៌បៃតងធម្មជាតិ
        },
        paperBg: '#FDFBF7',   // ពណ៌ក្រដាសផ្ទៃខាងក្រោយ
      },
      fontFamily: {
        'khmer-title': ['Moul', 'serif'],
        'khmer-body': ['"Kantumruy Pro"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}