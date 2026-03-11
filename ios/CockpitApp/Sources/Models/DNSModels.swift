import Foundation

struct DNSRecordsResponse: Decodable {
    let records: [DNSRecord]
}

struct DNSRecord: Decodable, Identifiable {
    let id: String
    let name: String
    let type: String
    let content: String
    let proxied: Bool
    let ttl: Int
    let createdOn: String?
    let modifiedOn: String?

    var shortName: String {
        name.replacingOccurrences(of: ".noahsark.me", with: "")
    }

    var ttlLabel: String {
        if ttl == 1 { return "Auto" }
        if ttl < 60 { return "\(ttl)s" }
        if ttl < 3600 { return "\(ttl / 60)m" }
        return "\(ttl / 3600)h"
    }
}

struct DNSZoneResponse: Decodable {
    let zone: DNSZone
}

struct DNSZone: Decodable, Identifiable {
    let id: String
    let name: String
    let status: String
}

struct CreateDNSRecordBody: Encodable {
    let type: String
    let name: String
    let content: String
    let proxied: Bool
    let ttl: Int
}

struct UpdateDNSRecordBody: Encodable {
    let type: String?
    let name: String?
    let content: String?
    let proxied: Bool?
    let ttl: Int?
}
