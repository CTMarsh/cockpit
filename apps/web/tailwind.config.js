/** @type {import('tailwindcss').Config} */
import arkPreset from "@noahs-ark/tokens/tailwind-preset";

// The `cockpit.*` hex block is preserved verbatim from the pre-migration
// config. Reason: Tailwind 3 can't compose `/opacity` modifiers on color
// values that are raw `var(--...)`, and many existing pages still use
// `bg-cockpit-accent/15` etc. Keeping the hex block means those pages
// render exactly as before; pages migrated to the new identity use `ark-*`
// from the preset. Sweep pages off `cockpit-*` in follow-up PRs, then drop
// this block entirely.
export default {
  presets: [arkPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
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
};
