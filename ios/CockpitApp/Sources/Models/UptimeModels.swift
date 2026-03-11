import Foundation

struct MonitoredService: Codable, Identifiable {
    let id: Int
    let name: String
    let url: String
    let checkInterval: Int
    let expectedStatus: Int
    let lastStatus: String?
    let lastResponseMs: Int?
    let lastCheckedAt: String?
    let createdAt: String?
}

struct UptimeCheck: Codable, Identifiable {
    let id: Int
    let serviceId: Int
    let status: String
    let responseMs: Int?
    let error: String?
    let checkedAt: String
}

struct UptimeStats: Codable {
    let uptimePercent: Double
    let avgResponseMs: Double
    let totalChecks: Int
    let lastCheck: String?
}

struct UptimeServicesResponse: Codable {
    let services: [MonitoredService]
}

struct UptimeHistoryResponse: Codable {
    let history: [UptimeCheck]
}

struct UptimeStatsResponse: Codable {
    let stats: UptimeStats
}

struct CreateMonitoredServiceBody: Encodable {
    let name: String
    let url: String
    let checkInterval: Int
    let expectedStatus: Int

    enum CodingKeys: String, CodingKey {
        case name, url
        case checkInterval = "check_interval"
        case expectedStatus = "expected_status"
    }
}
