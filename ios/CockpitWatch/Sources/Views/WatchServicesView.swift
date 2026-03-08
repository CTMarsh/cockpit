import SwiftUI

struct WatchServicesView: View {
    @State private var services: [ServiceStatus] = []
    @State private var summary: ServiceSummary?
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .tint(Theme.accent)
            } else if let error {
                VStack(spacing: 8) {
                    Image(systemName: "wifi.slash")
                        .font(.title3)
                        .foregroundStyle(Theme.danger)
                    Text(error)
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                        .multilineTextAlignment(.center)
                }
            } else if services.isEmpty {
                Text("No services")
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
            } else {
                List {
                    if let summary {
                        headerRow(summary: summary)
                    }
                    ForEach(services) { service in
                        serviceRow(service)
                    }
                }
                .listStyle(.carousel)
            }
        }
        .navigationTitle("Services")
        .containerBackground(Theme.background, for: .navigation)
        .task { await fetchData() }
        .refreshable { await fetchData() }
    }

    // MARK: - Header

    private func headerRow(summary: ServiceSummary) -> some View {
        HStack {
            Circle()
                .fill(summary.down == 0 ? Theme.success : Theme.danger)
                .frame(width: 8, height: 8)

            Text("\(summary.up)/\(summary.total) Up")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.text)

            Spacer()
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - Service Row

    private func serviceRow(_ service: ServiceStatus) -> some View {
        HStack(spacing: 8) {
            Circle()
                .fill(service.isUp ? Theme.success : Theme.danger)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 1) {
                Text(service.name)
                    .font(.caption)
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)

                if let ms = service.responseTime {
                    Text("\(ms)ms")
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                }
            }

            Spacer()
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - Data Fetching

    private func fetchData() async {
        isLoading = true
        error = nil
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
