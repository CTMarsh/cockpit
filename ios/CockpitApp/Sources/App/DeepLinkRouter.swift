import SwiftUI

@MainActor
final class DeepLinkRouter: ObservableObject {
    static let shared = DeepLinkRouter()
    @Published var selectedTab = 0
    @Published var pendingNavigation: String?

    func navigate(to module: String) {
        switch module {
        case "homelab", "proxmox", "sysmon", "k8s", "ha":
            selectedTab = 1
        case "bookmarks", "markdown", "graph", "dedup", "randomizer":
            selectedTab = 2
        case "logs", "cron", "wol", "alerts", "backups", "s3", "notify":
            selectedTab = 3
        default:
            selectedTab = 0
        }
        pendingNavigation = module
    }
}
