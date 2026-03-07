import Foundation

struct Backup: Codable, Identifiable {
    let key: String
    let name: String
    let size: Int
    let sizeHuman: String
    let lastModified: String

    var id: String { key }
}

struct BackupListResponse: Codable {
    let available: Bool
    let backups: [Backup]
}

struct BackupTriggerResponse: Codable {
    let ok: Bool
    let key: String?
    let originalSize: Int?
    let compressedSize: Int?
    let timestamp: String?
}

struct BackupHealthResponse: Codable {
    let available: Bool
    let bucket: String?
}
