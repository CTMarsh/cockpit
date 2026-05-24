import WidgetKit
import SwiftUI

/// Theme constants for widget rendering.
/// Mirrors the main app's Theme enum but lives in the widget target
/// to avoid importing the full app module.
///
/// Values match the Noah's Ark design system (`ArkTokens.Colors.*`).
/// OKLCH values are pre-computed to sRGB hex/decimal here so the widget
/// target stays standalone — no shared file with the main app.
///
/// `accent` maps to ark-primary (ocean blue) matching the Cockpit web
/// + iOS app accent → primary remap. `warning` stays warm-golden.
enum WidgetTheme {
    // ark-bg          oklch(0.16 0.04 245) ≈ #10141C
    static let background = Color(red: 0x10 / 255.0, green: 0x14 / 255.0, blue: 0x1C / 255.0)
    // ark-surface     oklch(0.20 0.04 245) ≈ #171D27
    static let surface    = Color(red: 0x17 / 255.0, green: 0x1D / 255.0, blue: 0x27 / 255.0)
    // ark-primary     oklch(0.65 0.14 235) ≈ #4D8FCB  (ocean blue)
    static let accent     = Color(red: 0x4D / 255.0, green: 0x8F / 255.0, blue: 0xCB / 255.0)
    // ark-text-bright oklch(0.96 0.01 230) ≈ #F1F4F6
    static let text       = Color(red: 0xF1 / 255.0, green: 0xF4 / 255.0, blue: 0xF6 / 255.0)
    // ark-text-muted  oklch(0.65 0.04 235) ≈ #8A99A4
    static let textMuted  = Color(red: 0x8A / 255.0, green: 0x99 / 255.0, blue: 0xA4 / 255.0)
    // ark-success     oklch(0.68 0.18 145) ≈ #4FA85C
    static let success    = Color(red: 0x4F / 255.0, green: 0xA8 / 255.0, blue: 0x5C / 255.0)
    // ark-danger      oklch(0.70 0.19 22)  ≈ #D96258
    static let danger     = Color(red: 0xD9 / 255.0, green: 0x62 / 255.0, blue: 0x58 / 255.0)
    // ark-warm        oklch(0.72 0.14 75)  ≈ #C59A4B  (warning stays warm/golden)
    static let warning    = Color(red: 0xC5 / 255.0, green: 0x9A / 255.0, blue: 0x4B / 255.0)
}

@main
struct CockpitWidgets: WidgetBundle {
    var body: some Widget {
        ClusterHealthWidget()
        ServiceStatusWidget()
        AlertCountWidget()
    }
}
