/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cockpit: {
          bg: "#0f0d0a",
          surface: "#1a1714",
          border: "#2a2520",
          accent: "#d4a24e",
          "accent-hover": "#e4b86a",
          text: "#e2d5c0",
          "text-muted": "#8a7e6d",
          success: "#5b9a6a",
          danger: "#c94a3a",
          warning: "#d4943e",
        },
      },
    },
  },
  plugins: [],
};
