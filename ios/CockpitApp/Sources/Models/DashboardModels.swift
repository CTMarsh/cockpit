import Foundation

struct DashboardStats: Decodable {
    let bookmarkCount: Int
    let docCount: Int
    let serviceCount: Int
    let recentBookmarks: [RecentBookmark]
    let recentDocs: [RecentDoc]
    let cronTotal: Int
    let cronEnabled: Int
    let cronFailed: Int
    let wolDeviceCount: Int
    let graphNodeCount: Int
    let graphEdgeCount: Int
    let ideaCount: Int
    let favoriteCount: Int
}

struct RecentBookmark: Decodable, Identifiable {
    let id: Int
    let url: String
    let title: String?
    let tags: String?
    let createdAt: String?
}

struct RecentDoc: Decodable, Identifiable {
    let id: Int
    let title: String
    let updatedAt: String?
}

struct HealthResponse: Decodable {
    let status: String
    let name: String
    let version: String
    let modules: Int
}
