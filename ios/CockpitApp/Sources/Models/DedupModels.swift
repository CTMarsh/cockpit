import Foundation

struct DedupScan: Codable, Identifiable {
    let id: String
    let directory: String
    let status: String
    let totalFiles: Int?
    let duplicateGroups: [DuplicateGroup]?
    let reclaimableBytes: Int?
    let startedAt: String?
    let completedAt: String?

    var isComplete: Bool { status == "complete" }
    var isScanning: Bool { status == "scanning" }
    var reclaimableHuman: String {
        guard let bytes = reclaimableBytes else { return "—" }
        if bytes < 1024 { return "\(bytes) B" }
        if bytes < 1024 * 1024 { return "\(bytes / 1024) KB" }
        if bytes < 1024 * 1024 * 1024 { return String(format: "%.1f MB", Double(bytes) / 1_048_576) }
        return String(format: "%.2f GB", Double(bytes) / 1_073_741_824)
    }
}

struct DuplicateGroup: Codable, Identifiable {
    let hash: String
    let size: Int
    let files: [String]

    var id: String { hash }
}

struct ScansResponse: Codable {
    let scans: [DedupScan]
}

struct ScanStartResponse: Codable {
    let id: String
    let status: String
}

struct AllowedDirsResponse: Codable {
    let directories: [String]
}

struct DeleteResult: Codable {
    let file: String
    let deleted: Bool
    let error: String?
}

struct DeleteResponse: Codable {
    let results: [DeleteResult]
    let deleted: Int
    let failed: Int
}

struct DeleteFilesBody: Encodable {
    let files: [String]
    let confirmed: Bool
}
