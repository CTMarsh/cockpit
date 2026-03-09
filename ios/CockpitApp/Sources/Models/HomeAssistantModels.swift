import Foundation

struct HAEntity: Codable, Identifiable {
    let entityId: String
    let state: String
    let domain: String?
    let friendlyName: String?
    let icon: String?
    let unit: String?
    let deviceClass: String?
    let lastChanged: String?
    let lastUpdated: String?

    var id: String { entityId }

    var displayName: String {
        friendlyName ?? entityId.replacingOccurrences(of: "_", with: " ")
    }

    var isToggleable: Bool {
        guard let domain else { return false }
        return ["switch", "light", "input_boolean", "automation", "fan"].contains(domain)
    }

    var isOn: Bool { state == "on" }

    var domainName: String {
        domain ?? String(entityId.prefix(while: { $0 != "." }))
    }
}

struct HAStatesResponse: Codable {
    let available: Bool
    let entities: [HAEntity]
}

struct HAServiceResponse: Codable {
    let ok: Bool
    let result: [HAEntity]?
}

