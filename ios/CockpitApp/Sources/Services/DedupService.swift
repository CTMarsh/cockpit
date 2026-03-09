import Foundation

@MainActor final class DedupService: ObservableObject {
    static let shared = DedupService()
    @Published var scans: [DedupScan] = []
    @Published var allowedDirs: [String] = []
    @Published var activeScan: DedupScan?
    @Published var isLoading = false
    @Published var error: String?

    private var pollTask: Task<Void, Never>?

    func fetchAllowedDirs() async {
        do {
            let resp: AllowedDirsResponse = try await APIClient.shared.request(path: "/api/dedup/allowed-dirs")
            allowedDirs = resp.directories
        } catch { self.error = error.localizedDescription }
    }

    func fetchScans() async {
        isLoading = scans.isEmpty
        do {
            let resp: ScansResponse = try await APIClient.shared.request(path: "/api/dedup/scans")
            scans = resp.scans
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func startScan(directory: String) async {
        do {
            let body = ["directory": directory]
            let resp: ScanStartResponse = try await APIClient.shared.request(path: "/api/dedup/scan", method: "POST", body: body)
            activeScan = DedupScan(id: resp.id, directory: directory, status: resp.status, totalFiles: nil, duplicateGroups: nil, reclaimableBytes: nil, startedAt: nil, completedAt: nil)
            startPolling(scanId: resp.id)
        } catch { self.error = error.localizedDescription }
    }

    func pollScan(id: String) async {
        do {
            let scan: DedupScan = try await APIClient.shared.request(path: "/api/dedup/scan/\(id)")
            activeScan = scan
            if scan.isComplete { stopPolling() }
        } catch { self.error = error.localizedDescription }
    }

    func deleteFiles(_ files: [String]) async -> DeleteResponse? {
        do {
            let body = DeleteFilesBody(files: files, confirmed: true)
            let resp: DeleteResponse = try await APIClient.shared.request(path: "/api/dedup/delete", method: "POST", body: body)
            return resp
        } catch { self.error = error.localizedDescription; return nil }
    }

    private func startPolling(scanId: String) {
        pollTask?.cancel()
        pollTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))
                await pollScan(id: scanId)
                if activeScan?.isComplete == true { break }
            }
        }
    }

    func stopPolling() { pollTask?.cancel() }
}
