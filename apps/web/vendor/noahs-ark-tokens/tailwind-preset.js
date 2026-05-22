/**
 * @noahs-ark/tokens — Tailwind preset
 *
 * Maps the ark.* and (deprecated) cockpit.* token namespaces onto the
 * --ark-* CSS custom properties defined in dist/tokens.css.
 *
 * Usage:
 *   import arkPreset from '@noahs-ark/tokens/tailwind-preset.js';
 *   export default { presets: [arkPreset], content: [...] };
 *
 * Both `ark-*` and `cockpit-*` class prefixes resolve to the same tokens so
 * the migration can be staged — sweep components from `cockpit-*` to `ark-*`
 * in follow-up PRs without breaking the build.
 */

/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Canonical namespace.
        //
        // Non-alpha base colors are wrapped in CSS relative-color syntax so
        // Tailwind's `/opacity` modifier composes (Tailwind 3 substitutes
        // <alpha-value>; default is 1 = no visual change). Requires modern
        // browsers: Chrome 119+, Safari 16.4+, Firefox 128+ — acceptable for
        // an internal homelab dashboard.
        //
        // Tokens with intentional baked-in alpha (`*-bg`, `*-ring`, borders)
        // stay as raw vars — applying the wrapper would override their
        // designed translucency.
        // Canonical namespace. CSS-var-backed — does NOT support Tailwind's
        // `/opacity` modifier (Tailwind 3 can't parse alpha out of `var(--...)`
        // holding `oklch(...)`). For translucent variants use the baked-alpha
        // tokens (`primary-bg`, `warm-bg`, etc) or `oklch(from ... / N)` in
        // arbitrary values like `bg-[oklch(from_var(--ark-bg)_l_c_h_/_0.5)]`.
        ark: {
          bg: "var(--ark-bg)",
          surface: "var(--ark-surface)",
          "surface-2": "var(--ark-surface-2)",
          "surface-3": "var(--ark-surface-3)",

          border: "var(--ark-border)",
          "border-muted": "var(--ark-border-muted)",
          "border-strong": "var(--ark-border-strong)",

          primary: "var(--ark-primary)",
          "primary-hover": "var(--ark-primary-hover)",
          "primary-dim": "var(--ark-primary-dim)",
          "primary-bg": "var(--ark-primary-bg)",
          "primary-ring": "var(--ark-primary-ring)",
          "on-primary": "var(--ark-on-primary)",

          warm: "var(--ark-warm)",
          "warm-hover": "var(--ark-warm-hover)",
          "warm-dim": "var(--ark-warm-dim)",
          "warm-bg": "var(--ark-warm-bg)",
          "on-warm": "var(--ark-on-warm)",

          text: "var(--ark-text)",
          "text-bright": "var(--ark-text-bright)",
          "text-muted": "var(--ark-text-muted)",
          "text-dim": "var(--ark-text-dim)",

          success: "var(--ark-success)",
          "success-bg": "var(--ark-success-bg)",
          danger: "var(--ark-danger)",
          "danger-bg": "var(--ark-danger-bg)",
          warning: "var(--ark-warning)",
          "warning-bg": "var(--ark-warning-bg)",
          info: "var(--ark-info)",
          "info-bg": "var(--ark-info-bg)",
        },

        // NOTE: this preset deliberately does NOT define a `cockpit.*` color
        // alias. Consuming apps must keep their pre-migration `cockpit.*` hex
        // block in `tailwind.config.js` so existing `bg-cockpit-*/opacity`
        // usages keep working. Sweep pages from `cockpit-*` → `ark-*` in
        // follow-up PRs.
      },

      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["Instrument Serif", "Iowan Old Style", "Georgia", "serif"],
      },

      fontSize: {
        "ark-display": ["var(--ark-fs-display)", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "300" }],
        "ark-h1":      ["var(--ark-fs-h1)",      { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        "ark-h2":      ["var(--ark-fs-h2)",      { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "600" }],
        "ark-h3":      ["var(--ark-fs-h3)",      { lineHeight: "1.3", fontWeight: "600" }],
        "ark-h4":      ["var(--ark-fs-h4)",      { lineHeight: "1.4", fontWeight: "600" }],
        "ark-body":    ["var(--ark-fs-body)",    { lineHeight: "1.5" }],
        "ark-body-lg": ["var(--ark-fs-body-lg)", { lineHeight: "1.5" }],
        "ark-caption": ["var(--ark-fs-caption)", { lineHeight: "1.4", letterSpacing: "0.02em" }],
        "ark-micro":   ["var(--ark-fs-micro)",   { lineHeight: "1.3", letterSpacing: "0.04em" }],
      },

      borderRadius: {
        ark: "var(--ark-radius)",
        "ark-sm": "var(--ark-radius-sm)",
        "ark-md": "var(--ark-radius-md)",
        "ark-lg": "var(--ark-radius-lg)",
        "ark-xl": "var(--ark-radius-xl)",
        "ark-2xl": "var(--ark-radius-2xl)",
        "ark-full": "var(--ark-radius-full)",
      },

      boxShadow: {
        "ark-xs": "var(--ark-shadow-xs)",
        "ark-sm": "var(--ark-shadow-sm)",
        "ark-md": "var(--ark-shadow-md)",
        "ark-lg": "var(--ark-shadow-lg)",
        "ark-modal": "var(--ark-shadow-modal)",
        "ark-primary": "var(--ark-shadow-primary)",
        "ark-primary-strong": "var(--ark-shadow-primary-strong)",
        "ark-focus": "var(--ark-shadow-focus)",
        "ark-focus-danger": "var(--ark-shadow-focus-danger)",
      },

      transitionTimingFunction: {
        ark: "var(--ark-ease)",
        "ark-out": "var(--ark-ease-out)",
        "ark-in-out": "var(--ark-ease-in-out)",
      },

      transitionDuration: {
        "ark-fast": "120ms",
        ark: "200ms",
        "ark-slow": "320ms",
      },
    },
  },
};

module.exports = preset;
module.exports.default = preset;
