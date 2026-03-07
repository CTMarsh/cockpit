import AppIntents

struct WakeDeviceIntent: AppIntent {
    static let title: LocalizedStringResource = "Wake Device"
    static let description = IntentDescription("Send a Wake-on-LAN packet to a device")
    static let openAppWhenRun = false

    @Parameter(title: "Device Name")
    var deviceName: String

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let api = APIClient.shared
        do {
            let resp: WakeDevicesResponse = try await api.request(path: "/api/wol/devices")
            guard let device = resp.devices.first(where: {
                $0.name.localizedCaseInsensitiveContains(deviceName)
            }) else {
                return .result(dialog: "No device found matching '\(deviceName)'.")
            }
            let _: WakeResponse = try await api.request(path: "/api/wol/wake/\(device.id)", method: "POST")
            return .result(dialog: "Wake-on-LAN sent to \(device.name).")
        } catch {
            return .result(dialog: "Failed to wake device.")
        }
    }
}

private struct WakeDevicesResponse: Codable {
    let devices: [WakeDeviceEntry]
}

private struct WakeDeviceEntry: Codable, Identifiable {
    let id: Int
    let name: String
}
