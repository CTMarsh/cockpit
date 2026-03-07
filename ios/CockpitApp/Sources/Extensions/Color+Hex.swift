import SwiftUI

extension Color {
    /// Create a Color from a hex string supporting #RRGGBB and #RRGGBBAA formats.
    /// The leading '#' is optional.
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

    /// Cockpit background: #0c1118
    static let cockpitBackground = Color(hex: "0c1118")
    /// Cockpit accent gold: #c8913a
    static let cockpitAccent = Color(hex: "c8913a")
    /// Cockpit surface: #1a2332
    static let cockpitSurface = Color(hex: "1a2332")
    /// Cockpit border: #1e2a38
    static let cockpitBorder = Color(hex: "1e2a38")
    /// Cockpit text: #e4e8ec
    static let cockpitText = Color(hex: "e4e8ec")
    /// Cockpit muted text: #8898a8
    static let cockpitTextMuted = Color(hex: "8898a8")
}
