import Foundation

@MainActor final class CertificateService: ObservableObject {
    static let shared = CertificateService()
    @Published var certificates: [Certificate] = []
    @Published var issuers: [CertIssuer] = []
    @Published var isLoading = false
    @Published var error: String?

    func fetchCertificates() async {
        isLoading = certificates.isEmpty
        do {
            let resp: CertificatesResponse = try await APIClient.shared.request(path: "/api/certificates")
            certificates = resp.certificates
            self.error = nil
        } catch { self.error = error.localizedDescription }
        isLoading = false
    }

    func fetchIssuers() async {
        do {
            let resp: IssuersResponse = try await APIClient.shared.request(path: "/api/certificates/issuers")
            issuers = resp.issuers
        } catch { self.error = error.localizedDescription }
    }

    func refresh() async {
        await fetchCertificates()
        await fetchIssuers()
    }
}
