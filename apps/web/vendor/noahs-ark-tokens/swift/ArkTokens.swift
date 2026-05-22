// =============================================================================
// ArkTokens.swift
// Swift mirror of @noahs-ark/tokens for iOS / watchOS / iPadOS / macOS targets.
//
// Generated from dist/tokens.css. Values are kept in sync by hand — if you
// edit a token here, edit the matching --ark-* property in tokens.css and
// vice versa. The CSS file is the source of truth.
//
// Usage:
//   .foregroundColor(ArkTokens.Colors.primary)
//   .font(ArkTokens.Type.h2)
//   .cornerRadius(ArkTokens.Radius.md)
// =============================================================================

import SwiftUI

public enum ArkTokens {

    // MARK: - Colors
    // OKLCH values from tokens.css converted to sRGB hex via Display-P3 round-trip.
    // Recompute if the CSS values change.
    public enum Colors {
        // Surfaces (dark)
        public static let bg          = Color(hex: 0x10141C) // oklch(0.16 0.04 245)
        public static let surface     = Color(hex: 0x171D27) // oklch(0.20 0.04 245)
        public static let surface2    = Color(hex: 0x232C39) // oklch(0.26 0.04 245)
        public static let surface3    = Color(hex: 0x2A3441) // oklch(0.30 0.04 245)

        // Borders (alpha on white)
        public static let border         = Color.white.opacity(0.12)
        public static let borderMuted    = Color.white.opacity(0.06)
        public static let borderStrong   = Color.white.opacity(0.22)

        // Primary — ocean blue
        public static let primary       = Color(hex: 0x4D8FCB) // oklch(0.65 0.14 235)
        public static let primaryHover  = Color(hex: 0x6CA2D6) // oklch(0.72 0.14 235)
        public static let primaryDim    = Color(hex: 0x2E5B7E) // oklch(0.45 0.10 235)
        public static let primaryBg     = Color(hex: 0x4D8FCB).opacity(0.12)
        public static let primaryRing   = Color(hex: 0x4D8FCB).opacity(0.50)
        public static let primaryGlow   = Color(hex: 0x4D8FCB).opacity(0.25)
        public static let onPrimary     = bg

        // Warm — golden secondary
        public static let warm          = Color(hex: 0xC59A4B) // oklch(0.72 0.14 75)
        public static let warmHover     = Color(hex: 0xD9B167) // oklch(0.80 0.14 75)
        public static let warmDim       = Color(hex: 0x7E5F2A) // oklch(0.50 0.12 75)
        public static let warmBg        = Color(hex: 0xC59A4B).opacity(0.12)
        public static let onWarm        = bg

        // Text
        public static let textBright    = Color(hex: 0xF1F4F6) // oklch(0.96 0.01 230)
        public static let text          = Color(hex: 0xCFD4D7) // oklch(0.85 0.01 230)
        public static let textMuted     = Color(hex: 0x8A99A4) // oklch(0.65 0.04 235)
        public static let textDim       = Color(hex: 0x5E6C77) // oklch(0.50 0.04 235)

        // Semantics
        public static let success       = Color(hex: 0x4FA85C) // oklch(0.68 0.18 145)
        public static let successBg     = success.opacity(0.12)
        public static let danger        = Color(hex: 0xD96258) // oklch(0.70 0.19 22)
        public static let dangerBg      = danger.opacity(0.12)
        public static let warning       = warm
        public static let warningBg     = warmBg
        public static let info          = Color(hex: 0x5FA0C8) // oklch(0.68 0.12 220)
        public static let infoBg        = info.opacity(0.12)
    }

    // MARK: - Typography
    public enum Type {
        public static let display = Font.custom("Inter", size: 40).weight(.light)
        public static let h1      = Font.custom("Inter", size: 30).weight(.bold)
        public static let h2      = Font.custom("Inter", size: 24).weight(.semibold)
        public static let h3      = Font.custom("Inter", size: 20).weight(.semibold)
        public static let h4      = Font.custom("Inter", size: 16).weight(.semibold)
        public static let body    = Font.custom("Inter", size: 14)
        public static let bodyLg  = Font.custom("Inter", size: 16)
        public static let caption = Font.custom("Inter", size: 12).weight(.medium)
        public static let micro   = Font.custom("Inter", size: 11).weight(.medium)
        public static let mono    = Font.custom("JetBrainsMono-Regular", size: 13)
        public static let serif   = Font.custom("InstrumentSerif-Regular", size: 16)
    }

    // MARK: - Spacing (raw points)
    public enum Spacing {
        public static let s1: CGFloat = 4
        public static let s2: CGFloat = 8
        public static let s3: CGFloat = 12
        public static let s4: CGFloat = 16
        public static let s6: CGFloat = 24
        public static let s8: CGFloat = 32
        public static let s12: CGFloat = 48
        public static let s16: CGFloat = 64
        public static let s24: CGFloat = 96
    }

    // MARK: - Radii
    public enum Radius {
        public static let sm: CGFloat = 6
        public static let `default`: CGFloat = 8
        public static let md: CGFloat = 10
        public static let lg: CGFloat = 14
        public static let xl: CGFloat = 18
        public static let xl2: CGFloat = 22
    }

    // MARK: - Motion
    public enum Motion {
        public static let durFast: Double = 0.12
        public static let dur: Double = 0.20
        public static let durSlow: Double = 0.32

        public static let easeOut    = Animation.timingCurve(0.16, 1, 0.3, 1, duration: dur)
        public static let easeInOut  = Animation.timingCurve(0.65, 0, 0.35, 1, duration: dur)
        public static let standard   = Animation.timingCurve(0.4, 0, 0.2, 1, duration: dur)
    }
}

// MARK: - Color hex convenience
public extension Color {
    init(hex: UInt32, opacity: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8) & 0xFF) / 255.0
        let b = Double(hex & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}
