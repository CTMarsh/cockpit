import SwiftUI
import UIKit

// MARK: - Haptic Feedback ViewModifier

struct HapticFeedbackModifier: ViewModifier {
    let style: UIImpactFeedbackGenerator.FeedbackStyle

    func body(content: Content) -> some View {
        content.onTapGesture {
            let generator = UIImpactFeedbackGenerator(style: style)
            generator.impactOccurred()
        }
    }
}

extension View {
    /// Attach an impact haptic that fires on tap.
    func hapticFeedback(_ style: UIImpactFeedbackGenerator.FeedbackStyle) -> some View {
        modifier(HapticFeedbackModifier(style: style))
    }

    /// Convenience: light impact haptic on tap.
    func hapticOnTap() -> some View {
        hapticFeedback(.light)
    }

    /// Trigger a success notification haptic.
    func hapticSuccess() -> some View {
        self.onAppear {
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
        }
    }

    /// Trigger a warning notification haptic.
    func hapticWarning() -> some View {
        self.onAppear {
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.warning)
        }
    }

    /// Trigger an error notification haptic.
    func hapticError() -> some View {
        self.onAppear {
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.error)
        }
    }
}
