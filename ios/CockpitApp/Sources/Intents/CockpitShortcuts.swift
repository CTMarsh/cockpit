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
        AppShortcut(
            intent: WakeDeviceIntent(),
            phrases: [
                "Wake a device with \(.applicationName)",
                "Send wake-on-LAN with \(.applicationName)"
            ],
            shortTitle: "Wake Device",
            systemImageName: "bolt.fill"
        )
        AppShortcut(
            intent: VMControlIntent(),
            phrases: [
                "Control a VM with \(.applicationName)",
                "Start a VM in \(.applicationName)",
                "Stop a VM in \(.applicationName)"
            ],
            shortTitle: "Control VM",
            systemImageName: "desktopcomputer"
        )
    }
}
