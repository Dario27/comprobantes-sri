/** @type {import('tailwindcss').Config} */
module.exports = {
  // Avoid conflicts with MUI: only apply Tailwind preflight to specific layers
  corePlugins: {
    preflight: false,
  },
  // Important selector ensures Tailwind utilities override MUI defaults when needed
  important: '#__next',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5888f1ff',
          dark:    '#3b6adaff',
          light:   '#3a7becff',
        },
        success: '#27ae60',
        danger:  '#e74c3c',
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,.08)',
      },
    },
  },
  plugins: [],
};
