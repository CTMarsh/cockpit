import Foundation

enum APIError: Error, LocalizedError {
    case unauthorized
    case serverError(Int, String)
    case networkError(Error)
    case decodingError(Error)
    case invalidURL

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Session expired. Please log in again."
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Data error: \(error.localizedDescription)"
        case .invalidURL:
            return "Invalid server URL."
        }
    }
}

@MainActor
final class APIClient: ObservableObject {
    static let shared = APIClient()

    @Published var isAuthenticated = false

    private let session: URLSession
    private let decoder: JSONDecoder

    var baseURL: String {
        get { UserDefaults.standard.string(forKey: "serverURL") ?? "https://dashboard.noahsark.me" }
        set { UserDefaults.standard.set(newValue, forKey: "serverURL") }
    }

    private init() {
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.httpCookieStorage = HTTPCookieStorage.shared
        session = URLSession(configuration: config)

        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        decoder.keyDecodingStrategy = .convertFromSnakeCase
    }

    // MARK: - Auth

    func login(username: String, password: String) async throws {
        let _: AuthResponse = try await request(
            path: "/api/auth/login",
            method: "POST",
            body: LoginBody(username: username, password: password)
        )
        isAuthenticated = true
    }

    func logout() async {
        _ = try? await request(path: "/api/auth/logout", method: "POST") as AuthResponse
        isAuthenticated = false
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
            isAuthenticated = false
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

    /// Fire-and-forget request (no response body needed)
    func send(path: String, method: String = "POST", body: (any Encodable)? = nil) async throws {
        let _: AuthResponse = try await request(path: path, method: method, body: body)
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
