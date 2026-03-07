import SwiftUI

struct ContentView: View {
    @ObservedObject private var auth = AuthService.shared

    var body: some View {
        Group {
            if auth.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .task {
            await auth.checkSession()
        }
    }
}

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Dashboard", systemImage: "square.grid.2x2", value: 0) {
                NavigationStack {
                    DashboardView()
                }
            }

            Tab("Infrastructure", systemImage: "server.rack", value: 1) {
                NavigationStack {
                    InfrastructureListView()
                }
            }

            Tab("Tools", systemImage: "wrench.and.screwdriver", value: 2) {
                NavigationStack {
                    ToolsListView()
                }
            }

            Tab("Operations", systemImage: "gearshape.2", value: 3) {
                NavigationStack {
                    OperationsListView()
                }
            }

            Tab("Settings", systemImage: "gearshape", value: 4) {
                NavigationStack {
                    SettingsView()
                }
            }
        }
        .tint(Theme.accent)
    }
}

// MARK: - Tab List Views (Milestone 1 placeholders — modules added in later milestones)

struct InfrastructureListView: View {
    var body: some View {
        List {
            NavigationLink("Homelab", destination: HomelabView())
            NavigationLink("Proxmox", destination: ProxmoxView())
            NavigationLink("Cluster Monitor", destination: SysmonView())
            NavigationLink("k3s Manager", destination: K8sView())
            NavigationLink("Home Assistant", destination: HomeAssistantView())
        }
        .navigationTitle("Infrastructure")
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
    }
}

struct ToolsListView: View {
    var body: some View {
        List {
            NavigationLink("Bookmarks", destination: BookmarksView())
            NavigationLink("Markdown", destination: MarkdownView())
            NavigationLink("Graph", destination: PlaceholderView(title: "Graph"))
            NavigationLink("Dedup", destination: DedupView())
            NavigationLink("Randomizer", destination: RandomizerView())
        }
        .navigationTitle("Tools")
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
    }
}

struct OperationsListView: View {
    var body: some View {
        List {
            NavigationLink("Logs", destination: LogsView())
            NavigationLink("Cron Jobs", destination: CronView())
            NavigationLink("Wake-on-LAN", destination: WolView())
            NavigationLink("Alerts", destination: AlertsView())
            NavigationLink("Backups", destination: BackupsView())
            NavigationLink("MinIO", destination: MinIOView())
            NavigationLink("Notify", destination: NotifyView())
        }
        .navigationTitle("Operations")
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
    }
}

struct SettingsView: View {
    @ObservedObject private var auth = AuthService.shared
    @ObservedObject private var api = APIClient.shared
    @State private var serverURL: String = ""

    var body: some View {
        List {
            Section("Server") {
                TextField("Server URL", text: $serverURL)
                    .textContentType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onAppear { serverURL = api.baseURL }
                    .onSubmit { api.baseURL = serverURL }
            }

            Section("Account") {
                Button("Sign Out", role: .destructive) {
                    Task { await auth.logout() }
                }
            }

            Section("About") {
                LabeledContent("Version", value: "0.1.0")
                LabeledContent("Build", value: "1")
            }
        }
        .navigationTitle("Settings")
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
    }
}

struct PlaceholderView: View {
    let title: String

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 12) {
                Image(systemName: "hammer")
                    .font(.system(size: 48))
                    .foregroundStyle(Theme.textMuted)
                Text(title)
                    .font(.title2.bold())
                    .foregroundStyle(Theme.text)
                Text("Coming soon")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textMuted)
            }
        }
        .navigationTitle(title)
    }
}
