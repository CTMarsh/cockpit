import SwiftUI

struct ContentView: View {
    @EnvironmentObject var connectivity: WatchConnectivityManager
    @EnvironmentObject var api: WatchAPIClient

    var body: some View {
        if api.isAuthenticated {
            NavigationStack {
                List {
                    NavigationLink {
                        WatchDashboardView()
                    } label: {
                        Label("Dashboard", systemImage: "gauge.with.dots.needle.67percent")
                            .foregroundStyle(Theme.text)
                    }

                    NavigationLink {
                        WatchServicesView()
                    } label: {
                        Label("Services", systemImage: "server.rack")
                            .foregroundStyle(Theme.text)
                    }

                    NavigationLink {
                        WatchClusterView()
                    } label: {
                        Label("Cluster", systemImage: "cpu")
                            .foregroundStyle(Theme.text)
                    }

                    NavigationLink {
                        WatchWoLView()
                    } label: {
                        Label("Wake-on-LAN", systemImage: "wake")
                            .foregroundStyle(Theme.text)
                    }

                    NavigationLink {
                        WatchAlertsView()
                    } label: {
                        Label("Alerts", systemImage: "bell.badge")
                            .foregroundStyle(Theme.text)
                    }

                    NavigationLink {
                        WatchVMsView()
                    } label: {
                        Label("VMs", systemImage: "desktopcomputer")
                            .foregroundStyle(Theme.text)
                    }
                }
                .listStyle(.carousel)
                .navigationTitle("Cockpit")
                .containerBackground(Theme.background, for: .navigation)
            }
        } else {
            NavigationStack {
                WatchLoginView()
            }
        }
    }
}
