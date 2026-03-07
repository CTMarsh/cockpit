import SwiftUI

/// Cockpit dark nautical theme — matches web Tailwind cockpit-* tokens
enum Theme {
    static let background = Color(hex: "0c1118")
    static let surface = Color(hex: "141c26")
    static let border = Color(hex: "1e2a38")
    static let accent = Color(hex: "c8913a")
    static let text = Color(hex: "e4e8ec")
    static let textMuted = Color(hex: "8898a8")
    static let success = Color(hex: "34d399")
    static let danger = Color(hex: "f87171")
    static let warning = Color(hex: "fbbf24")
    static let info = Color(hex: "60a5fa")
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6:
            (r, g, b) = ((int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: 1
        )
    }
}
