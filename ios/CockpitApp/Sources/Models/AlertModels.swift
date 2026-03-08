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

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        metricType = try container.decode(String.self, forKey: .metricType)
        `operator` = try container.decodeIfPresent(String.self, forKey: .operator)
        threshold = try container.decode(Double.self, forKey: .threshold)
        target = try container.decodeIfPresent(String.self, forKey: .target)
        cooldownMinutes = try container.decodeIfPresent(Int.self, forKey: .cooldownMinutes)
        webhookUrl = try container.decodeIfPresent(String.self, forKey: .webhookUrl)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        // Handle SQLite integer (0/1) or JSON boolean for enabled
        if let boolValue = try? container.decode(Bool.self, forKey: .enabled) {
            enabled = boolValue
        } else if let intValue = try? container.decode(Int.self, forKey: .enabled) {
            enabled = intValue != 0
        } else {
            enabled = true
        }
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
