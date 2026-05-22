# @noahs-ark/tokens

Visual design tokens for the Noah's Ark homelab platform. One package, three artifacts: a CSS file of custom properties, a Tailwind preset that re-exports them as theme values, and a Swift enum mirror for Apple-platform clients.

## What's inside

```
dist/
  tokens.css              78 --ark-* CSS custom properties (dark + light)
  components.css          optional .ark-btn / .ark-card / .ark-input primitives
tailwind-preset.js        Tailwind theme extension using the CSS vars
swift/
  ArkTokens.swift         SwiftUI enum mirror of the tokens (manually kept in sync)
assets/
  logo/                   ark-icon.jpg, noahs-ark-mark.svg, noahs-ark-wordmark.svg
  icons/                  Lucide subset (anchor, compass, server, …)
  imagery/                ark-login-bg.jpg
  textures/               chart-grid.svg (the only repeating texture in the system)
```

## Install

```bash
# from your private GitLab npm registry or wherever you publish
bun add @noahs-ark/tokens
```

## Usage — web (CSS only)

```css
@import "@noahs-ark/tokens/tokens.css";
/* optional — pre-styled .ark-btn / .ark-card / .ark-input primitives */
@import "@noahs-ark/tokens/components.css";

.my-card {
  background: var(--ark-surface);
  border: 1px solid var(--ark-border);
  border-radius: var(--ark-radius-md);
  box-shadow: var(--ark-shadow-xs);
}
```

## Usage — web (Tailwind)

```js
// tailwind.config.js
import arkPreset from "@noahs-ark/tokens/tailwind-preset";

export default {
  presets: [arkPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
};
```

```css
/* src/index.css */
@import "@noahs-ark/tokens/tokens.css";

@tailwind base;
@tailwind components;
@tailwind utilities;
```

```tsx
<button className="bg-ark-primary text-ark-on-primary rounded-ark hover:bg-ark-primary-hover shadow-ark-primary">
  Save changes
</button>
```

> ℹ️ The Tailwind preset also exposes the legacy `cockpit-*` namespace (`bg-cockpit-bg`, `text-cockpit-accent`, etc.) as aliases pointing at the same tokens. This lets the Cockpit-web migration land in stages — the layout/shell PR can swap palettes without touching every page component on day one.

## Usage — iOS / watchOS / macOS

Drop `swift/ArkTokens.swift` into your target (or vendor it as a Swift package). Then:

```swift
import SwiftUI

struct StatusBadge: View {
    var body: some View {
        Text("HEALTHY")
            .font(ArkTokens.Type.micro)
            .foregroundColor(ArkTokens.Colors.success)
            .padding(.horizontal, ArkTokens.Spacing.s2)
            .padding(.vertical, ArkTokens.Spacing.s1)
            .background(ArkTokens.Colors.successBg)
            .cornerRadius(ArkTokens.Radius.sm)
    }
}
```

The Swift hex values were derived from the OKLCH definitions in `tokens.css`. If you change a CSS token, recompute the corresponding hex in `ArkTokens.swift` — the CSS file is the source of truth.

## Fonts

By default, `tokens.css` `@import`s **Inter**, **JetBrains Mono**, and **Instrument Serif** from Google Fonts. For production / offline / privacy-sensitive deployments, drop the woff2 variable files into a sibling `fonts/` directory in your app and replace the `@import` with `@font-face` declarations pointing at them.

iOS targets need to add the same fonts to the bundle as Resources and declare them in `Info.plist` (`UIAppFonts`).

## Versioning

`0.1.0` — initial extraction. Token names and values may shift before `1.0.0`. Once stable, semver applies: minor bumps add tokens, patch bumps refine values without renaming, majors rename or remove.

## Source of truth

This package was extracted from the Noah's Ark design system. The canonical visual reference lives in that project; updates to tokens should originate there and flow back into this package.
