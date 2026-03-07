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
            NavigationLink("Proxmox", destination: PlaceholderView(title: "Proxmox"))
            NavigationLink("Cluster Monitor", destination: PlaceholderView(title: "Cluster Monitor"))
            NavigationLink("k3s Manager", destination: PlaceholderView(title: "k3s Manager"))
            NavigationLink("Home Assistant", destination: PlaceholderView(title: "Home Assistant"))
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
            NavigationLink("Bookmarks", destination: PlaceholderView(title: "Bookmarks"))
            NavigationLink("Markdown", destination: PlaceholderView(title: "Markdown"))
            NavigationLink("Graph", destination: PlaceholderView(title: "Graph"))
            NavigationLink("Dedup", destination: PlaceholderView(title: "Dedup"))
            NavigationLink("Randomizer", destination: PlaceholderView(title: "Randomizer"))
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
            NavigationLink("Logs", destination: PlaceholderView(title: "Logs"))
            NavigationLink("Cron Jobs", destination: PlaceholderView(title: "Cron Jobs"))
            NavigationLink("Wake-on-LAN", destination: PlaceholderView(title: "Wake-on-LAN"))
            NavigationLink("Alerts", destination: PlaceholderView(title: "Alerts"))
            NavigationLink("Backups", destination: PlaceholderView(title: "Backups"))
            NavigationLink("MinIO", destination: PlaceholderView(title: "MinIO"))
            NavigationLink("Notify", destination: PlaceholderView(title: "Notify"))
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
