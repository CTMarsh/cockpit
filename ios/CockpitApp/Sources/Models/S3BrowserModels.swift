import Foundation

struct S3Object: Codable, Identifiable {
    let key: String
    let size: Int?
    let lastModified: String?

    var id: String { key }
    var sizeHuman: String {
        guard let size else { return "—" }
        if size < 1024 { return "\(size) B" }
        if size < 1024 * 1024 { return "\(size / 1024) KB" }
        return String(format: "%.1f MB", Double(size) / 1_048_576)
    }
}

struct BucketsResponse: Codable {
    let available: Bool
    let buckets: [String]
}

struct ObjectsResponse: Codable {
    let available: Bool
    let bucket: String
    let prefix: String?
    let prefixes: [String]?
    let objects: [S3Object]
}
