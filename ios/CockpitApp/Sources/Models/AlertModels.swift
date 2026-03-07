import Foundation

struct AlertRule: Codable, Identifiable {
    let id: String
    let name: String
    let metricType: String
    let `operator`: String?
    let threshold: Double
    let target: String?
    let cooldownMinutes: Int?
    let enabled: Bool
    let webhookUrl: String?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, metricType, threshold, target, enabled, webhookUrl
        case `operator`, cooldownMinutes, createdAt, updatedAt
    }
}

struct AlertHistory: Codable, Identifiable {
    let id: Int
    let ruleId: String
    let ruleName: String
    let metricType: String
    let value: Double
    let threshold: Double
    let message: String
    let firedAt: String
}

struct AlertRulesResponse: Codable {
    let rules: [AlertRule]
}

struct AlertHistoryResponse: Codable {
    let history: [AlertHistory]
}

struct CreateAlertBody: Encodable {
    let name: String
    let metricType: String
    let `operator`: String
    let threshold: Double
    let target: String?
    let cooldownMinutes: Int?
    let enabled: Bool?

    enum CodingKeys: String, CodingKey {
        case name, threshold, target, enabled
        case metricType = "metric_type"
        case `operator`
        case cooldownMinutes = "cooldown_minutes"
    }
}
