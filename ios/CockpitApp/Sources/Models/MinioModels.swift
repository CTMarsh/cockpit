import Foundation

struct MinioBucket: Codable, Identifiable {
    let name: String
    let creationDate: String?

    var id: String { name }
}

struct MinioObject: Codable, Identifiable {
    let name: String
    let size: Int?
    let lastModified: String?
    let etag: String?

    var id: String { name }
    var sizeHuman: String {
        guard let size else { return "—" }
        if size < 1024 { return "\(size) B" }
        if size < 1024 * 1024 { return "\(size / 1024) KB" }
        return String(format: "%.1f MB", Double(size) / 1_048_576)
    }
}

struct BucketsResponse: Codable {
    let available: Bool
    let buckets: [MinioBucket]
}

struct ObjectsResponse: Codable {
    let available: Bool
    let bucket: String
    let prefix: String?
    let prefixes: [String]?
    let objects: [MinioObject]
}
