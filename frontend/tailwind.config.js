/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      colors: {
        ally: {
          navy: "#1B2A4A",
          accent: "#4A90D9",
        },
      },
      boxShadow: {
        orbit: "0 25px 50px -12px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
