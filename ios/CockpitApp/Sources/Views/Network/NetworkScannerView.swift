import SwiftUI

struct NetworkScannerView: View {
    @ObservedObject private var service = NetworkService.shared
    @State private var subnet = "10.0.80.0/24"
    @State private var scanningPortsFor: String?

    var body: some View {
        List {
            if let error = service.error {
                Section {
                    ErrorBanner(message: error)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }

            if service.isLoading && service.devices.isEmpty {
                Section {
                    LoadingView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                }
                .listRowBackground(Color.clear)
            } else if service.devices.isEmpty && service.error == nil {
                Section {
                    VStack(spacing: 12) {
                        Image(systemName: "network")
                            .font(.system(size: 48))
                            .foregroundStyle(Theme.textMuted)
                        Text("No devices found")
                            .foregroundStyle(Theme.textMuted)
                        Text("Run a scan to discover devices")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                }
                .listRowBackground(Color.clear)
            } else {
                let online = service.devices.filter(\.isOnline)
                let offline = service.devices.filter { !$0.isOnline }

                if !online.isEmpty {
                    Section {
                        ForEach(online) { device in
                            DeviceRow(device: device, scanningPortsFor: $scanningPortsFor)
                        }
                        .onDelete { offsets in
                            deleteDevices(from: online, at: offsets)
                        }
                    } header: {
                        HStack {
                            Text("Online")
                            Spacer()
                            Text("\(online.count)")
                                .foregroundStyle(Theme.success)
                        }
                    }
                }

                if !offline.isEmpty {
                    Section {
                        ForEach(offline) { device in
                            DeviceRow(device: device, scanningPortsFor: $scanningPortsFor)
                        }
                        .onDelete { offsets in
                            deleteDevices(from: offline, at: offsets)
                        }
                    } header: {
                        HStack {
                            Text("Offline")
                            Spacer()
                            Text("\(offline.count)")
                                .foregroundStyle(Theme.danger)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Network Scanner")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await service.scan(subnet: subnet) }
                } label: {
                    if service.isScanning {
                        ProgressView()
                    } else {
                        Image(systemName: "antenna.radiowaves.left.and.right")
                    }
                }
                .disabled(service.isScanning)
            }
        }
        .refreshable { await service.fetchDevices() }
        .onAppear { service.startPolling() }
        .onDisappear { service.stopPolling() }
    }

    private func deleteDevices(from list: [NetworkDevice], at offsets: IndexSet) {
        for index in offsets {
            let device = list[index]
            Task { await service.deleteDevice(id: device.id) }
        }
    }
}

// MARK: - Device Row

private struct DeviceRow: View {
    let device: NetworkDevice
    @Binding var scanningPortsFor: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Circle()
                    .fill(device.isOnline ? Theme.success : Theme.danger)
                    .frame(width: 8, height: 8)

                Text(device.displayName)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.text)

                Spacer()

                if let mac = device.mac {
                    Text(mac)
                        .font(.caption2.monospaced())
                        .foregroundStyle(Theme.textMuted)
                }
            }

            HStack(spacing: 8) {
                Text(device.ip)
                    .font(.caption.monospaced())
                    .foregroundStyle(Theme.textMuted)

                if let hostname = device.hostname, hostname != device.label {
                    Text(hostname)
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }

                Spacer()

                if scanningPortsFor == device.ip {
                    ProgressView()
                        .controlSize(.mini)
                } else {
                    Button {
                        scanningPortsFor = device.ip
                        Task {
                            await NetworkService.shared.portScan(ip: device.ip)
                            scanningPortsFor = nil
                        }
                    } label: {
                        Image(systemName: "magnifyingglass")
                            .font(.caption2)
                    }
                    .buttonStyle(.borderless)
                    .tint(Theme.accent)
                }
            }

            if !device.parsedPorts.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        ForEach(device.parsedPorts, id: \.self) { port in
                            Text("\(port)")
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(Theme.accent)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Theme.accent.opacity(0.15))
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
        .padding(.vertical, 4)
        .listRowBackground(Theme.surface)
    }
}
