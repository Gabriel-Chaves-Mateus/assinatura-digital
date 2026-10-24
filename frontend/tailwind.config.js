/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  // preflight desligado para não conflitar com o reset do Material-UI
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};
