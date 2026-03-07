import WidgetKit
import SwiftUI

/// Theme constants for widget rendering.
/// Mirrors the main app's Theme enum but lives in the widget target
/// to avoid importing the full app module.
enum WidgetTheme {
    static let background = Color(red: 0.047, green: 0.067, blue: 0.094)
    static let surface = Color(red: 0.078, green: 0.110, blue: 0.149)
    static let accent = Color(red: 0.784, green: 0.569, blue: 0.227)
    static let text = Color(red: 0.894, green: 0.910, blue: 0.925)
    static let textMuted = Color(red: 0.533, green: 0.596, blue: 0.659)
    static let success = Color(red: 0.204, green: 0.827, blue: 0.600)
    static let danger = Color(red: 0.973, green: 0.443, blue: 0.443)
    static let warning = Color(red: 0.984, green: 0.749, blue: 0.141)
}

@main
struct CockpitWidgets: WidgetBundle {
    var body: some Widget {
        ClusterHealthWidget()
        ServiceStatusWidget()
        AlertCountWidget()
    }
}
