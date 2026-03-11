import Foundation

@MainActor
final class DNSService: ObservableObject {
    static let shared = DNSService()

    @Published var records: [DNSRecord] = []
    @Published var zone: DNSZone?
    @Published var isLoading = false
    @Published var error: String?

    private let api = APIClient.shared

    private init() {}

    func fetchRecords() async {
        isLoading = records.isEmpty
        error = nil

        do {
            let response: DNSRecordsResponse = try await api.request(path: "/api/dns/records")
            records = response.records
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func fetchZone() async {
        do {
            let response: DNSZoneResponse = try await api.request(path: "/api/dns/zone")
            zone = response.zone
        } catch {}
    }

    func createRecord(type: String, name: String, content: String, proxied: Bool, ttl: Int) async {
        do {
            try await api.send(
                path: "/api/dns/records",
                method: "POST",
                body: CreateDNSRecordBody(type: type, name: name, content: content, proxied: proxied, ttl: ttl)
            )
            await fetchRecords()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func updateRecord(id: String, type: String?, name: String?, content: String?, proxied: Bool?, ttl: Int?) async {
        do {
            try await api.send(
                path: "/api/dns/records/\(id)",
                method: "PUT",
                body: UpdateDNSRecordBody(type: type, name: name, content: content, proxied: proxied, ttl: ttl)
            )
            await fetchRecords()
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteRecord(id: String) async {
        do {
            try await api.send(path: "/api/dns/records/\(id)", method: "DELETE")
            records.removeAll { $0.id == id }
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = error.localizedDescription
        }
    }
}
