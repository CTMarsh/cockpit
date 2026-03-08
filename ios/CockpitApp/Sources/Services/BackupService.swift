import Foundation

@MainActor class BackupService: ObservableObject {
    static let shared = BackupService()
    @Published var backups: [Backup] = []
    @Published var isAvailable = false
    @Published var isLoading = false
    @Published var isTriggering = false
    @Published var error: String?

    func fetchBackups() async {
        isLoading = backups.isEmpty
        do {
            let resp: BackupListResponse = try await APIClient.shared.request(path: "/api/backup/list")
            backups = resp.backups
            isAvailable = resp.available
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func downloadURL(for backup: Backup) -> URL? {
        let base = APIClient.shared.baseURL
        return URL(string: "\(base)/api/backup/download/\(backup.key)")
    }

    func triggerBackup() async -> Bool {
        isTriggering = true
        do {
            let _: BackupTriggerResponse = try await APIClient.shared.request(path: "/api/backup/trigger", method: "POST")
            await fetchBackups()
            isTriggering = false
            return true
        } catch {
            self.error = error.localizedDescription
            isTriggering = false
            return false
        }
    }
}
