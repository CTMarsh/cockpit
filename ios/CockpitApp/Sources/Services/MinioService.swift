import Foundation

@MainActor class MinioService: ObservableObject {
    static let shared = MinioService()
    @Published var buckets: [MinioBucket] = []
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
            buckets.removeAll { $0.name == name }
        } catch { self.error = error.localizedDescription }
    }

    func deleteObject(bucket: String, key: String) async {
        do {
            let _: GenericOKResponse = try await APIClient.shared.request(path: "/api/minio/objects/\(bucket)/\(key)", method: "DELETE")
            objects.removeAll { $0.name == key }
        } catch { self.error = error.localizedDescription }
    }
}
