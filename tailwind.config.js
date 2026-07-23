/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Consolas', 'Cascadia Code', 'Courier New', 'monospace']
      }
    }
  },
  plugins: []
}
