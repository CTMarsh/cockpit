import SwiftUI

struct WolView: View {
    @ObservedObject private var service = WolService.shared
    @State private var wakingId: String?
    @State private var showAddDevice = false

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if service.isLoading && service.devices.isEmpty {
                    LoadingView()
                } else if service.devices.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "bolt.circle")
                            .font(.system(size: 48))
                            .foregroundStyle(Theme.textMuted)
                        Text("No WoL devices")
                            .foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 60)
                } else {
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                    ], spacing: 12) {
                        ForEach(service.devices) { device in
                            DeviceCard(device: device, isWaking: wakingId == device.id) {
                                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                                Task {
                                    wakingId = device.id
                                    let sent = await service.wake(id: device.id)
                                    if sent {
                                        let generator = UINotificationFeedbackGenerator()
                                        generator.notificationOccurred(.success)
                                    }
                                    try? await Task.sleep(for: .seconds(1))
                                    wakingId = nil
                                }
                            } onDelete: {
                                Task { await service.deleteDevice(id: device.id) }
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Wake-on-LAN")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAddDevice = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showAddDevice) {
            AddWolDeviceSheet()
        }
        .refreshable { await service.fetchDevices() }
        .onAppear { service.startPolling() }
        .onDisappear { service.stopPolling() }
    }
}

// MARK: - Add Device Sheet

private struct AddWolDeviceSheet: View {
    @ObservedObject private var service = WolService.shared
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var mac = ""
    @State private var ip = ""
    @State private var broadcast = ""
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Device Name") {
                    TextField("Gaming PC", text: $name)
                }
                Section("MAC Address") {
                    TextField("AA:BB:CC:DD:EE:FF", text: $mac)
                        .textInputAutocapitalization(.never)
                        .font(.body.monospaced())
                }
                Section("IP Address (optional)") {
                    TextField("10.0.80.100", text: $ip)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.decimalPad)
                }
                Section("Broadcast (optional)") {
                    TextField("10.0.80.255", text: $broadcast)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.decimalPad)
                }
            }
            .navigationTitle("Add Device")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        isSaving = true
                        Task {
                            await service.addDevice(
                                name: name,
                                mac: mac,
                                ip: ip.isEmpty ? nil : ip,
                                broadcast: broadcast.isEmpty ? nil : broadcast
                            )
                            dismiss()
                        }
                    }
                    .disabled(name.isEmpty || mac.isEmpty || isSaving)
                }
            }
        }
    }
}

// MARK: - Device Card

private struct DeviceCard: View {
    let device: WolDevice
    let isWaking: Bool
    let onWake: () -> Void
    let onDelete: () -> Void
    @State private var showDeleteConfirm = false

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Circle()
                    .fill(device.online == true ? Theme.success : Theme.textMuted)
                    .frame(width: 8, height: 8)
                Spacer()
                Button(role: .destructive) { showDeleteConfirm = true } label: {
                    Image(systemName: "trash")
                        .font(.caption2)
                }
                .tint(Theme.danger.opacity(0.6))
            }

            Image(systemName: "desktopcomputer")
                .font(.title2)
                .foregroundStyle(device.online == true ? Theme.success : Theme.textMuted)

            Text(device.name)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.text)
                .lineLimit(1)

            if let ip = device.ip, !ip.isEmpty {
                Text(ip)
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)
            }

            Button {
                onWake()
            } label: {
                if isWaking {
                    ProgressView()
                        .tint(Theme.background)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                } else {
                    Text("Wake")
                        .font(.caption.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
            }
            .background(device.online == true ? Theme.surface : Theme.accent)
            .foregroundStyle(device.online == true ? Theme.textMuted : Theme.background)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .disabled(isWaking)
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
        .confirmationDialog("Delete \(device.name)?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) { onDelete() }
        }
    }
}
