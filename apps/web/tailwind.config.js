/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cockpit: {
          bg: "#0a0a0f",
          surface: "#12121a",
          border: "#1e1e2e",
          accent: "#3b82f6",
          "accent-hover": "#60a5fa",
          text: "#e2e8f0",
          "text-muted": "#64748b",
          success: "#22c55e",
          danger: "#ef4444",
          warning: "#f59e0b",
        },
      },
    },
  },
  plugins: [],
};
