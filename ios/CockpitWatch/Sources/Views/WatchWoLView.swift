import SwiftUI
import WatchKit

struct WatchWoLView: View {
    @State private var devices: [WolDevice] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var wakeTarget: WolDevice?
    @State private var wakingDeviceId: String?

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
            } else if devices.isEmpty {
                Text("No WoL devices")
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
            } else {
                List {
                    ForEach(devices) { device in
                        deviceRow(device)
                    }
                }
                .listStyle(.carousel)
            }
        }
        .navigationTitle("Wake-on-LAN")
        .containerBackground(Theme.background, for: .navigation)
        .task { await fetchData() }
        .refreshable { await fetchData() }
        .alert("Wake Device?", isPresented: .init(
            get: { wakeTarget != nil },
            set: { if !$0 { wakeTarget = nil } }
        )) {
            Button("Wake", role: .destructive) {
                if let device = wakeTarget {
                    Task { await wakeDevice(device) }
                }
            }
            Button("Cancel", role: .cancel) {
                wakeTarget = nil
            }
        } message: {
            if let device = wakeTarget {
                Text("Send wake packet to \(device.name)?")
            }
        }
    }

    // MARK: - Device Row

    private func deviceRow(_ device: WolDevice) -> some View {
        Button {
            wakeTarget = device
        } label: {
            HStack(spacing: 8) {
                Circle()
                    .fill(device.online == true ? Theme.success : Theme.textMuted.opacity(0.4))
                    .frame(width: 8, height: 8)

                VStack(alignment: .leading, spacing: 1) {
                    Text(device.name)
                        .font(.caption)
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)

                    Text(device.online == true ? "Online" : "Offline")
                        .font(.caption2)
                        .foregroundStyle(device.online == true ? Theme.success : Theme.textMuted)
                }

                Spacer()

                if wakingDeviceId == device.id {
                    ProgressView()
                        .controlSize(.mini)
                        .tint(Theme.accent)
                } else {
                    Image(systemName: "power")
                        .font(.caption)
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .buttonStyle(.plain)
        .listRowBackground(Theme.surface)
    }

    // MARK: - Wake Action

    private func wakeDevice(_ device: WolDevice) async {
        wakingDeviceId = device.id
        do {
            let _: WakeResponse = try await WatchAPIClient.shared.request(
                path: "/api/wol/\(device.id)/wake",
                method: "POST"
            )
            WKInterfaceDevice.current().play(.success)
        } catch {
            WKInterfaceDevice.current().play(.failure)
            self.error = "Wake failed"
        }
        wakingDeviceId = nil
    }

    // MARK: - Data Fetching

    private func fetchData() async {
        isLoading = true
        error = nil
        do {
            let response: WolDevicesResponse = try await WatchAPIClient.shared.request(path: "/api/wol")
            devices = response.devices
        } catch {
            self.error = "Cannot reach server"
        }
        isLoading = false
    }
}
