import SwiftUI

/// Compact services page for vertical TabView — single screen, no scroll.
struct WatchServicesPage: View {
    @State private var services: [ServiceStatus] = []
    @State private var summary: ServiceSummary?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        VStack(spacing: 8) {
            if isLoading {
                Spacer()
                ProgressView().tint(Theme.accent)
                Spacer()
            } else if let error {
                Spacer()
                Image(systemName: "wifi.slash")
                    .font(.title3)
                    .foregroundStyle(Theme.danger)
                Text(error)
                    .font(.caption2)
                    .foregroundStyle(Theme.danger)
                Spacer()
            } else {
                // Header
                HStack {
                    Text("Services")
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                    Spacer()
                    if let summary {
                        Text("\(summary.up)/\(summary.total)")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(summary.down == 0 ? Theme.success : Theme.danger)
                    }
                }

                // Show first 4 services as compact rows
                ForEach(services.prefix(4)) { service in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(service.isUp ? Theme.success : Theme.danger)
                            .frame(width: 7, height: 7)
                        Text(service.name)
                            .font(.caption2)
                            .foregroundStyle(Theme.text)
                            .lineLimit(1)
                        Spacer()
                        if let ms = service.responseTime {
                            Text("\(ms)ms")
                                .font(.system(size: 9))
                                .foregroundStyle(Theme.textMuted)
                        }
                    }
                }

                if services.count > 4 {
                    NavigationLink(destination: WatchServicesView()) {
                        HStack {
                            Text("All \(services.count) services")
                                .font(.caption2)
                                .foregroundStyle(Theme.accent)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 9))
                                .foregroundStyle(Theme.accent)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 8)
        .containerBackground(Theme.background, for: .tabView)
        .task { await fetchData() }
    }

    private func fetchData() async {
        isLoading = true
        do {
            let response: ServicesResponse = try await WatchAPIClient.shared.request(path: "/api/homelab/services")
            services = response.services
            summary = response.summary
        } catch {
            self.error = "Cannot reach server"
        }
        isLoading = false
    }
}
