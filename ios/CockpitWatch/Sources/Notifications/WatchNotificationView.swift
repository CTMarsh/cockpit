import SwiftUI

struct WatchNotificationView: View {
    let title: String
    let message: String
    let module: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Module badge
            HStack(spacing: 4) {
                Image(systemName: moduleIcon)
                    .font(.caption2)
                    .foregroundStyle(moduleColor)

                if let module {
                    Text(module.capitalized)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(moduleColor)
                }
            }

            // Title
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.text)
                .lineLimit(2)

            // Body text
            Text(message)
                .font(.caption2)
                .foregroundStyle(Theme.textMuted)
                .lineLimit(4)

            // Colored accent bar
            RoundedRectangle(cornerRadius: 2)
                .fill(moduleColor)
                .frame(height: 2)
        }
        .padding(8)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Module Styling

    private var moduleIcon: String {
        switch module?.lowercased() {
        case "homelab", "services":
            return "server.rack"
        case "sysmon", "cluster":
            return "cpu"
        case "proxmox":
            return "desktopcomputer"
        case "cron":
            return "clock"
        case "alerts":
            return "exclamationmark.triangle"
        case "wol":
            return "power"
        default:
            return "bell.fill"
        }
    }

    private var moduleColor: Color {
        switch module?.lowercased() {
        case "homelab", "services":
            return Theme.success
        case "sysmon", "cluster":
            return Theme.info
        case "proxmox":
            return Theme.accent
        case "cron":
            return Theme.warning
        case "alerts":
            return Theme.danger
        case "wol":
            return Theme.accent
        default:
            return Theme.accent
        }
    }
}
