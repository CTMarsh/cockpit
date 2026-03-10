import SwiftUI
import WatchKit

/// Compact WoL page for vertical TabView — single screen, no scroll.
struct WatchWoLPage: View {
    @State private var devices: [WolDevice] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var wakeTarget: WolDevice?
    @State private var wakingDeviceId: String?

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
            } else if devices.isEmpty {
                Spacer()
                Text("No WoL devices")
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
                Spacer()
            } else {
                // Header
                HStack {
                    Text("Wake-on-LAN")
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                    Spacer()
                    Text("\(devices.filter { $0.online == true }.count)/\(devices.count)")
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                }

                // Show first 4 devices
                ForEach(devices.prefix(4)) { device in
                    Button {
                        wakeTarget = device
                    } label: {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(device.online == true ? Theme.success : Theme.textMuted.opacity(0.4))
                                .frame(width: 7, height: 7)
                            Text(device.name)
                                .font(.caption2)
                                .foregroundStyle(Theme.text)
                                .lineLimit(1)
                            Spacer()
                            if wakingDeviceId == device.id {
                                ProgressView()
                                    .controlSize(.mini)
                                    .tint(Theme.accent)
                            } else {
                                Image(systemName: "power")
                                    .font(.system(size: 9))
                                    .foregroundStyle(Theme.accent)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }

                if devices.count > 4 {
                    NavigationLink(destination: WatchWoLView()) {
                        HStack {
                            Text("All \(devices.count) devices")
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
        .alert("Wake Device?", isPresented: .init(
            get: { wakeTarget != nil },
            set: { if !$0 { wakeTarget = nil } }
        )) {
            Button("Wake", role: .destructive) {
                if let device = wakeTarget {
                    Task { await wakeDevice(device) }
                }
            }
            Button("Cancel", role: .cancel) { wakeTarget = nil }
        } message: {
            if let device = wakeTarget {
                Text("Send wake packet to \(device.name)?")
            }
        }
    }

    private func wakeDevice(_ device: WolDevice) async {
        wakingDeviceId = device.id
        do {
            let _: WakeResponse = try await WatchAPIClient.shared.request(
                path: "/api/wol/wake/\(device.id)",
                method: "POST"
            )
            WKInterfaceDevice.current().play(.success)
        } catch {
            WKInterfaceDevice.current().play(.failure)
        }
        wakingDeviceId = nil
    }

    private func fetchData() async {
        isLoading = true
        do {
            let r: WolDevicesResponse = try await WatchAPIClient.shared.request(path: "/api/wol/devices")
            devices = r.devices
        } catch {
            self.error = "Cannot reach server"
        }
        isLoading = false
    }
}
