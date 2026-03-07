import AppIntents

struct CockpitShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ClusterStatusIntent(),
            phrases: [
                "Check cluster status with \(.applicationName)",
                "How is my cluster in \(.applicationName)"
            ],
            shortTitle: "Cluster Status",
            systemImageName: "server.rack"
        )
        AppShortcut(
            intent: ServiceHealthIntent(),
            phrases: [
                "Are my services up in \(.applicationName)",
                "Check service health with \(.applicationName)"
            ],
            shortTitle: "Service Health",
            systemImageName: "heart.text.clipboard"
        )
    }
}
