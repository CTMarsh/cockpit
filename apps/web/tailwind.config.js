/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cockpit: {
          bg: "#0c1118",
          surface: "#131c24",
          border: "#1e2d38",
          accent: "#c8913a",
          "accent-hover": "#daa54e",
          text: "#d5cfc2",
          "text-muted": "#6b7d8a",
          success: "#5a9a5c",
          danger: "#b84a3e",
          warning: "#c8913a",
        },
      },
    },
  },
  plugins: [],
};
