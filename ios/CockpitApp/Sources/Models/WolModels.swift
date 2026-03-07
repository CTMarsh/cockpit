import Foundation

struct WolDevicesResponse: Decodable {
    let devices: [WolDevice]
}

struct WolDevice: Decodable, Identifiable {
    let id: Int
    let name: String
    let mac: String
    let ip: String?
    let broadcast: String?
    let createdAt: String?
    let online: Bool?
}

struct WakeResponse: Decodable {
    let ok: Bool
    let name: String?
    let mac: String?
}

struct CreateWolDeviceBody: Encodable {
    let name: String
    let mac: String
    let ip: String?
    let broadcast: String?
}
