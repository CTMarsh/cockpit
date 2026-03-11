import SwiftUI

struct UptimeView: View {
    @ObservedObject private var service = UptimeMonitorService.shared
    @State private var showAddService = false
    @State private var selectedService: MonitoredService?

    var body: some View {
        VStack(spacing: 0) {
            if let error = service.error {
                ErrorBanner(message: error)
                    .padding(.horizontal)
            }

            if service.isLoading {
                LoadingView()
            } else {
                List {
                    ForEach(service.services) { svc in
                        Button {
                            selectedService = svc
                        } label: {
                            UptimeServiceRow(service: svc)
                        }
                        .listRowBackground(Theme.surface)
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                Task { await service.deleteService(id: svc.id) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                        .swipeActions(edge: .leading) {
                            Button {
                                Task { await service.checkOne(id: svc.id) }
                            } label: {
                                Label("Check", systemImage: "arrow.clockwise")
                            }
                            .tint(Theme.accent)
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
        .background(Theme.background)
        .navigationTitle("Uptime Monitor")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 12) {
                    Button {
                        Task { await service.checkAll() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    Button { showAddService = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .refreshable {
            await service.fetchServices()
        }
        .task {
            await service.fetchServices()
        }
        .sheet(isPresented: $showAddService) {
            AddServiceSheet()
        }
        .sheet(item: $selectedService) { svc in
            NavigationStack {
                ServiceDetailView(monitoredService: svc)
            }
        }
    }
}

private struct UptimeServiceRow: View {
    let service: MonitoredService

    private var isUp: Bool {
        service.lastStatus == "up"
    }

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(isUp ? Theme.success : (service.lastStatus == nil ? Theme.textMuted : Theme.danger))
                .frame(width: 10, height: 10)

            VStack(alignment: .leading, spacing: 2) {
                Text(service.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.text)
                Text(service.url)
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
                    .lineLimit(1)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(isUp ? "UP" : (service.lastStatus ?? "---"))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(isUp ? Theme.success : (service.lastStatus == nil ? Theme.textMuted : Theme.danger))
                if let ms = service.lastResponseMs {
                    Text("\(ms)ms")
                        .font(.caption2.monospaced())
                        .foregroundStyle(Theme.textMuted)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private struct ServiceDetailView: View {
    let monitoredService: MonitoredService
    @ObservedObject private var service = UptimeMonitorService.shared
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Stats Card
                if let stats = service.stats {
                    VStack(spacing: 12) {
                        Text("Uptime Statistics")
                            .font(.headline)
                            .foregroundStyle(Theme.text)

                        HStack(spacing: 20) {
                            StatItem(label: "Uptime", value: String(format: "%.1f%%", stats.uptimePercent),
                                     color: stats.uptimePercent >= 99 ? Theme.success : (stats.uptimePercent >= 95 ? Theme.accent : Theme.danger))
                            StatItem(label: "Avg Response", value: String(format: "%.0fms", stats.avgResponseMs), color: Theme.accent)
                            StatItem(label: "Total Checks", value: "\(stats.totalChecks)", color: Theme.textMuted)
                        }
                    }
                    .padding(16)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
                }

                // Recent History
                VStack(alignment: .leading, spacing: 8) {
                    Text("Recent Checks")
                        .font(.headline)
                        .foregroundStyle(Theme.text)

                    if service.history.isEmpty {
                        Text("No check history yet")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                            .padding(.vertical, 8)
                    } else {
                        ForEach(service.history) { check in
                            HStack {
                                Circle()
                                    .fill(check.status == "up" ? Theme.success : Theme.danger)
                                    .frame(width: 8, height: 8)
                                Text(check.status.uppercased())
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(check.status == "up" ? Theme.success : Theme.danger)
                                if let ms = check.responseMs {
                                    Text("\(ms)ms")
                                        .font(.caption.monospaced())
                                        .foregroundStyle(Theme.textMuted)
                                }
                                Spacer()
                                Text(check.checkedAt.prefix(16))
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(Theme.textMuted)
                            }
                            .padding(8)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                    }
                }
            }
            .padding()
        }
        .background(Theme.background)
        .navigationTitle(monitoredService.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task {
                        await service.checkOne(id: monitoredService.id)
                        await service.fetchStats(serviceId: monitoredService.id)
                        await service.fetchHistory(serviceId: monitoredService.id)
                    }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .task {
            await service.fetchStats(serviceId: monitoredService.id)
            await service.fetchHistory(serviceId: monitoredService.id)
        }
    }
}

private struct StatItem: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3.weight(.bold).monospaced())
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct AddServiceSheet: View {
    @ObservedObject private var service = UptimeMonitorService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var url = "https://"
    @State private var checkInterval = "60"
    @State private var expectedStatus = "200"

    var body: some View {
        NavigationStack {
            Form {
                Section("Service Details") {
                    TextField("Name", text: $name)
                    TextField("URL", text: $url)
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                }
                Section("Check Settings") {
                    TextField("Check Interval (seconds)", text: $checkInterval)
                        .keyboardType(.numberPad)
                    TextField("Expected HTTP Status", text: $expectedStatus)
                        .keyboardType(.numberPad)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Add Service")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        guard let interval = Int(checkInterval),
                              let status = Int(expectedStatus) else { return }
                        let body = CreateMonitoredServiceBody(
                            name: name,
                            url: url,
                            checkInterval: interval,
                            expectedStatus: status
                        )
                        Task {
                            if await service.createService(body) { dismiss() }
                        }
                    }
                    .disabled(name.isEmpty || url.count < 8)
                }
            }
        }
    }
}
