import SwiftUI

/// Cockpit iOS theme - delegates to the Noah's Ark design system.
///
/// The 10 public properties below KEEP their pre-migration names so every
/// existing call site (`Theme.background`, `Theme.accent`, etc.) renders
/// with the new identity automatically. Values now come from
/// `ArkTokens.Colors.*` instead of inline brass-era hex.
///
/// New code should prefer `ArkTokens.Colors.*` directly. This shim exists
/// to keep the view-layer diff zero for this MR. Sweep call sites to
/// `ArkTokens.*` in follow-up commits if desired.
///
/// `accent` maps to ArkTokens.Colors.primary (ocean blue) to match the
/// Cockpit web remap (accent is used here for primary CTAs / active states,
/// not a warm decorative role). `warning` stays warm/golden because that
/// IS its semantic role.
enum Theme {
    static let background = ArkTokens.Colors.bg
    static let surface    = ArkTokens.Colors.surface
    static let border     = ArkTokens.Colors.border
    static let accent     = ArkTokens.Colors.primary
    static let text       = ArkTokens.Colors.text
    static let textMuted  = ArkTokens.Colors.textMuted
    static let success    = ArkTokens.Colors.success
    static let danger     = ArkTokens.Colors.danger
    static let warning    = ArkTokens.Colors.warm
    static let info       = ArkTokens.Colors.info
}
