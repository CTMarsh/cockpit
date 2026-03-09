import Foundation

@MainActor final class MinioService: ObservableObject {
    static let shared = MinioService()
    @Published var buckets: [String] = []
    @Published var objects: [MinioObject] = []
    @Published var prefixes: [String] = []
    @Published var currentBucket: String?
    @Published var currentPrefix: String = ""
    @Published var isLoading = false
    @Published var error: String?

    func fetchBuckets() async {
        isLoading = buckets.isEmpty
        do {
            let resp: BucketsResponse = try await APIClient.shared.request(path: "/api/minio/buckets")
            buckets = resp.buckets
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchObjects(bucket: String, prefix: String = "") async {
        isLoading = true
        currentBucket = bucket
        currentPrefix = prefix
        do {
            var path = "/api/minio/objects/\(bucket)"
            if !prefix.isEmpty { path += "?prefix=\(prefix)" }
            let resp: ObjectsResponse = try await APIClient.shared.request(path: path)
            objects = resp.objects
            prefixes = resp.prefixes ?? []
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func createBucket(name: String) async -> Bool {
        do {
            let body = ["name": name]
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/minio/buckets", method: "POST", body: body)
            await fetchBuckets()
            return true
        } catch { self.error = error.localizedDescription; return false }
    }

    func deleteBucket(name: String) async {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/minio/buckets/\(name)", method: "DELETE")
            buckets.removeAll { $0 == name }
        } catch { self.error = error.localizedDescription }
    }

    func deleteObject(bucket: String, key: String) async {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/minio/objects/\(bucket)/\(key)", method: "DELETE")
            objects.removeAll { $0.key == key }
        } catch { self.error = error.localizedDescription }
    }

    func downloadURL(bucket: String, key: String) -> URL? {
        let base = APIClient.shared.baseURL
        return URL(string: "\(base)/api/minio/download/\(bucket)/\(key)")
    }

    func uploadObject(bucket: String, prefix: String, fileName: String, data: Data, contentType: String) async -> Bool {
        let key = prefix.isEmpty ? fileName : "\(prefix)\(fileName)"
        guard let url = URL(string: "\(APIClient.shared.baseURL)/api/minio/upload/\(bucket)/\(key)") else {
            error = "Invalid upload URL"
            return false
        }
        do {
            var req = URLRequest(url: url)
            req.httpMethod = "PUT"
            req.setValue(contentType, forHTTPHeaderField: "Content-Type")
            req.httpBody = data
            let config = URLSessionConfiguration.default
            config.httpCookieStorage = HTTPCookieStorage.shared
            let session = URLSession(configuration: config)
            let (_, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse, http.statusCode < 400 else {
                error = "Upload failed"
                return false
            }
            await fetchObjects(bucket: bucket, prefix: prefix)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
}
