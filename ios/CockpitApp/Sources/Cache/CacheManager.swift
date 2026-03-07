import Foundation

final class CacheManager: @unchecked Sendable {
    static let shared = CacheManager()
    private let fileManager = FileManager.default
    private let ttl: TimeInterval = 3600 // 1 hour

    private var cacheDir: URL {
        fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first!
            .appendingPathComponent("cockpit-api", isDirectory: true)
    }

    private init() {
        try? fileManager.createDirectory(at: cacheDir, withIntermediateDirectories: true)
    }

    // MARK: - Hot Cache (UserDefaults — shared with widgets via App Group)

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: "group.com.ctmarsh.cockpit")
    }

    func setHot(key: String, value: any Codable) {
        if let data = try? JSONEncoder().encode(value) {
            sharedDefaults?.set(data, forKey: "hot_\(key)")
            sharedDefaults?.set(Date().timeIntervalSince1970, forKey: "hot_\(key)_ts")
        }
    }

    func getHot<T: Codable>(key: String, as type: T.Type) -> T? {
        guard let data = sharedDefaults?.data(forKey: "hot_\(key)") else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    // MARK: - Cold Cache (FileManager — full API responses)

    func setCold(endpoint: String, data: Data) {
        let file = cacheFile(for: endpoint)
        try? data.write(to: file)
        // Store timestamp
        let meta = file.appendingPathExtension("meta")
        let ts = "\(Date().timeIntervalSince1970)".data(using: .utf8)
        try? ts?.write(to: meta)
    }

    func getCold(endpoint: String) -> Data? {
        let file = cacheFile(for: endpoint)
        let meta = file.appendingPathExtension("meta")

        guard fileManager.fileExists(atPath: file.path),
              let tsData = try? Data(contentsOf: meta),
              let tsString = String(data: tsData, encoding: .utf8),
              let ts = Double(tsString) else { return nil }

        let age = Date().timeIntervalSince1970 - ts
        if age > ttl { return nil } // Expired

        return try? Data(contentsOf: file)
    }

    func getColdStale(endpoint: String) -> Data? {
        let file = cacheFile(for: endpoint)
        guard fileManager.fileExists(atPath: file.path) else { return nil }
        return try? Data(contentsOf: file)
    }

    private func cacheFile(for endpoint: String) -> URL {
        let safeKey = endpoint.replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "?", with: "_")
        return cacheDir.appendingPathComponent(safeKey)
    }

    // MARK: - Cleanup

    func clearAll() {
        try? fileManager.removeItem(at: cacheDir)
        try? fileManager.createDirectory(at: cacheDir, withIntermediateDirectories: true)
    }
}
