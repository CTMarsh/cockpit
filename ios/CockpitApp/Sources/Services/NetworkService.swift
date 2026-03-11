import Foundation

@MainActor
final class NetworkService: ObservableObject {
    static let shared = NetworkService()

    @Published var devices: [NetworkDevice] = []
    @Published var isLoading = false
    @Published var isScanning = false
    @Published var error: String?

    private let api = APIClient.shared
    private var pollingTask: Task<Void, Never>?

    private init() {}

    func fetchDevices() async {
        isLoading = devices.isEmpty
        error = nil

        do {
            let response: NetworkDevicesResponse = try await api.request(path: "/api/network/devices")
            devices = response.devices
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func scan(subnet: String) async {
        isScanning = true
        error = nil

        do {
            let response: ScanResponse = try await api.request(
                path: "/api/network/scan",
                method: "POST",
                body: ScanRequest(subnet: subnet)
            )
            devices = response.devices
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isScanning = false
    }

    func portScan(ip: String) async {
        do {
            let _: GenericOKResponse = try await api.request(
                path: "/api/network/portscan/\(ip)",
                method: "POST"
            )
            await fetchDevices()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func updateDevice(id: Int, label: String?, hostname: String?) async {
        do {
            try await api.send(
                path: "/api/network/devices/\(id)",
                method: "PUT",
                body: UpdateDeviceBody(label: label, hostname: hostname)
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
            try await api.send(path: "/api/network/devices/\(id)", method: "DELETE")
            devices.removeAll { $0.id == id }
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Polling

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
