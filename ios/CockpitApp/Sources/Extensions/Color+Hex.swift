import SwiftUI

extension Color {
    /// Create a Color from a hex string supporting #RRGGBB and #RRGGBBAA formats.
    /// The leading '#' is optional. Kept for callers that need #RRGGBBAA alpha
    /// support; ArkTokens.Colors.* provides the standard palette via opaque
    /// values + .opacity(_) for translucency.
    init(hexString: String) {
        let hex = hexString.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)

        let r, g, b: UInt64
        let a: UInt64
        switch hex.count {
        case 6: // RRGGBB
            (r, g, b, a) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF, 255)
        case 8: // RRGGBBAA
            (r, g, b, a) = ((int >> 24) & 0xFF, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (r, g, b, a) = (0, 0, 0, 255)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    // MARK: - Theme Convenience Colors
    //
    // Delegated to ArkTokens (the Noah's Ark design system Swift mirror).
    // Names preserved so existing call sites keep working. cockpitAccent is
    // mapped to ArkTokens.Colors.primary (ocean blue), matching the web
    // app's accent->primary semantic.

    /// Cockpit background — delegates to ArkTokens.Colors.bg
    static let cockpitBackground = ArkTokens.Colors.bg
    /// Cockpit accent — delegates to ArkTokens.Colors.primary (ocean blue)
    static let cockpitAccent = ArkTokens.Colors.primary
    /// Cockpit surface — delegates to ArkTokens.Colors.surface
    static let cockpitSurface = ArkTokens.Colors.surface
    /// Cockpit border — delegates to ArkTokens.Colors.border
    static let cockpitBorder = ArkTokens.Colors.border
    /// Cockpit text — delegates to ArkTokens.Colors.text
    static let cockpitText = ArkTokens.Colors.text
    /// Cockpit muted text — delegates to ArkTokens.Colors.textMuted
    static let cockpitTextMuted = ArkTokens.Colors.textMuted
}
