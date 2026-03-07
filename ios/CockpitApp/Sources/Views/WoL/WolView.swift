import SwiftUI

struct WolView: View {
    @ObservedObject private var service = WolService.shared
    @State private var wakingId: Int?

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
                        Image(systemName: "wake")
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
                                Task {
                                    wakingId = device.id
                                    let sent = await service.wake(id: device.id)
                                    if sent {
                                        // Haptic feedback
                                        let generator = UINotificationFeedbackGenerator()
                                        generator.notificationOccurred(.success)
                                    }
                                    try? await Task.sleep(for: .seconds(1))
                                    wakingId = nil
                                }
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
        .refreshable { await service.fetchDevices() }
        .onAppear { service.startPolling() }
        .onDisappear { service.stopPolling() }
    }
}

private struct DeviceCard: View {
    let device: WolDevice
    let isWaking: Bool
    let onWake: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Circle()
                    .fill(device.online == true ? Theme.success : Theme.textMuted)
                    .frame(width: 8, height: 8)
                Spacer()
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
    }
}
