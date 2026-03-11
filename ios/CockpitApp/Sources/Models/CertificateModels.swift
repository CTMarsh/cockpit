import Foundation

struct Certificate: Codable, Identifiable {
    let name: String
    let namespace: String
    let secretName: String
    let issuerName: String
    let dnsNames: [String]
    let notBefore: String?
    let notAfter: String?
    let renewalTime: String?
    let ready: Bool
    let message: String?
    let daysUntilExpiry: Int?

    var id: String { "\(namespace)/\(name)" }
}

struct CertIssuer: Codable, Identifiable {
    let name: String
    let kind: String
    let email: String?
    let server: String?
    let ready: Bool

    var id: String { name }
}

struct CertificatesResponse: Codable {
    let certificates: [Certificate]
}

struct IssuersResponse: Codable {
    let issuers: [CertIssuer]
}

struct CertHealthResponse: Codable {
    let available: Bool
    let totalCertificates: Int?
    let expiringSoon: Int?
}
