import Foundation

/// Lightweight API client for watchOS standalone mode.
/// Used when the paired iPhone is not reachable and the watch
/// must communicate directly with the Cockpit API over cellular/Wi-Fi.
@MainActor
final class WatchAPIClient: ObservableObject {
    static let shared = WatchAPIClient()

    @Published var isAuthenticated = false

    private let session: URLSession
    private let decoder: JSONDecoder

    private let defaultBaseURL = "https://dashboard.noahsark.me"

    var baseURL: String {
        UserDefaults.standard.string(forKey: "serverURL") ?? defaultBaseURL
    }

    private init() {
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        session = URLSession(configuration: config)

        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
    }

    // MARK: - Auth

    /// Authenticate using credentials stored in the shared Keychain.
    /// Returns true if login succeeded.
    @discardableResult
    func loginFromKeychain() async -> Bool {
        guard let creds = KeychainHelper.loadCredentials() else {
            isAuthenticated = false
            return false
        }

        do {
            try await login(username: creds.username, password: creds.password)
            return true
        } catch {
            isAuthenticated = false
            return false
        }
    }

    func login(username: String, password: String) async throws {
        let _: AuthResponse = try await request(
            path: "/api/auth/login",
            method: "POST",
            body: LoginBody(username: username, password: password)
        )
        isAuthenticated = true
    }

    func checkSession() async -> Bool {
        do {
            let response: MeResponse = try await request(path: "/api/auth/me")
            isAuthenticated = response.authenticated
            return response.authenticated
        } catch {
            isAuthenticated = false
            return false
        }
    }

    // MARK: - Generic Request

    func request<T: Decodable>(
        path: String,
        method: String = "GET",
        body: (any Encodable)? = nil
    ) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: req)
        } catch {
            throw APIError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        if http.statusCode == 401 {
            // Try re-authenticating once from keychain
            if !isAuthenticated {
                throw APIError.unauthorized
            }
            isAuthenticated = false
            let loggedIn = await loginFromKeychain()
            if loggedIn {
                // Retry the original request once
                return try await retryRequest(url: url, method: method, body: body)
            }
            throw APIError.unauthorized
        }

        if http.statusCode >= 400 {
            let message = (try? decoder.decode(ErrorBody.self, from: data))?.error ?? "Unknown error"
            throw APIError.serverError(http.statusCode, message)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    /// Raw request using the shared session (for cookie handling during device code polling)
    func pollRequest(url: URL) async throws -> (Data, URLResponse) {
        try await session.data(from: url)
    }

    // MARK: - Private

    private func retryRequest<T: Decodable>(
        url: URL,
        method: String,
        body: (any Encodable)?
    ) async throws -> T {
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await session.data(for: req)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        if http.statusCode == 401 {
            throw APIError.unauthorized
        }

        if http.statusCode >= 400 {
            let message = (try? decoder.decode(ErrorBody.self, from: data))?.error ?? "Unknown error"
            throw APIError.serverError(http.statusCode, message)
        }

        return try decoder.decode(T.self, from: data)
    }
}

// MARK: - Internal Models

private struct LoginBody: Encodable {
    let username: String
    let password: String
}

private struct ErrorBody: Decodable {
    let error: String
}

struct AuthResponse: Decodable {
    let ok: Bool?
}

struct MeResponse: Decodable {
    let authenticated: Bool
    let user: String?
}

enum APIError: Error, LocalizedError {
    case unauthorized
    case serverError(Int, String)
    case networkError(Error)
    case decodingError(Error)
    case invalidURL

    var errorDescription: String? {
        switch self {
        case .unauthorized: "Session expired. Please log in again."
        case .serverError(let code, let message): "Server error (\(code)): \(message)"
        case .networkError(let error): "Network error: \(error.localizedDescription)"
        case .decodingError(let error): "Data error: \(error.localizedDescription)"
        case .invalidURL: "Invalid server URL."
        }
    }
}
