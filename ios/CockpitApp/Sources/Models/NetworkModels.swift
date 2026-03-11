import Foundation

struct NetworkDevicesResponse: Decodable {
    let devices: [NetworkDevice]
}

struct NetworkDevice: Decodable, Identifiable {
    let id: Int
    let ip: String
    let mac: String?
    let hostname: String?
    let label: String?
    let firstSeen: String?
    let lastSeen: String?
    let ports: String?
    let status: String?

    var parsedPorts: [Int] {
        guard let ports, !ports.isEmpty else { return [] }
        let data = Data(ports.utf8)
        return (try? JSONDecoder().decode([Int].self, from: data)) ?? []
    }

    var isOnline: Bool {
        status == "online"
    }

    var displayName: String {
        label ?? hostname ?? ip
    }
}

struct ScanRequest: Encodable {
    let subnet: String
}

struct ScanResponse: Decodable {
    let devices: [NetworkDevice]
}

struct UpdateDeviceBody: Encodable {
    let label: String?
    let hostname: String?
}
