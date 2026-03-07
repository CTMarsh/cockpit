import Foundation

@MainActor
final class WolService: ObservableObject {
    static let shared = WolService()

    @Published var devices: [WolDevice] = []
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared
    private var pollingTask: Task<Void, Never>?

    private init() {}

    func fetchDevices() async {
        isLoading = devices.isEmpty
        error = nil

        do {
            let response: WolDevicesResponse = try await api.request(path: "/api/wol/devices")
            devices = response.devices
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func wake(id: Int) async -> Bool {
        do {
            let _: WakeResponse = try await api.request(
                path: "/api/wol/wake/\(id)",
                method: "POST"
            )
            return true
        } catch let apiError as APIError {
            error = apiError.errorDescription
            return false
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func addDevice(name: String, mac: String, ip: String?, broadcast: String?) async {
        do {
            try await api.send(
                path: "/api/wol/devices",
                method: "POST",
                body: CreateWolDeviceBody(name: name, mac: mac, ip: ip, broadcast: broadcast)
            )
            await fetchDevices()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteDevice(id: Int) async {
        do {
            try await api.send(path: "/api/wol/devices/\(id)", method: "DELETE")
            devices.removeAll { $0.id == id }
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func startPolling() {
        stopPolling()
        pollingTask = Task {
            while !Task.isCancelled {
                await fetchDevices()
                try? await Task.sleep(for: .seconds(30))
            }
        }
    }

    func stopPolling() {
        pollingTask?.cancel()
        pollingTask = nil
    }
}
