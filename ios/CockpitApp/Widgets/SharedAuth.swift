import Foundation
import Security

/// Lightweight auth helper for widget extensions.
/// Shares credentials via Keychain access group and caches the session cookie
/// in shared UserDefaults to avoid re-authenticating every timeline refresh.
enum SharedAuth: Sendable {
    private static let accessGroup = "group.com.ctmarsh.cockpit"
    private static let service = "com.ctmarsh.noahsark-cockpit"
    private static let suiteName = "group.com.ctmarsh.cockpit"
    private static let baseURL = "https://dashboard.noahsark.me"

    // MARK: - Keychain (shared with main app)

    private static func loadKeychainValue(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecAttrAccessGroup as String: accessGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func loadCredentials() -> (username: String, password: String)? {
        guard let username = loadKeychainValue(key: "username"),
              let password = loadKeychainValue(key: "password") else {
            return nil
        }
        return (username, password)
    }

    // MARK: - Session Cookie Cache

    private static var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    /// Reads the cached cookie header string and its expiry from shared UserDefaults.
    private static func cachedCookieHeader() -> String? {
        guard let header = sharedDefaults?.string(forKey: "widgetCookieHeader") else {
            return nil
        }
        // Check if cookie has expired
        if let expiry = sharedDefaults?.object(forKey: "widgetCookieExpiry") as? Date,
           expiry < Date() {
            sharedDefaults?.removeObject(forKey: "widgetCookieHeader")
            sharedDefaults?.removeObject(forKey: "widgetCookieExpiry")
            return nil
        }
        return header
    }

    /// Caches the Set-Cookie response so we can reuse it across timeline refreshes.
    private static func cacheCookieHeader(_ header: String) {
        sharedDefaults?.set(header, forKey: "widgetCookieHeader")
        // Cache for 23 hours (session is 24h, leave margin)
        let expiry = Date().addingTimeInterval(23 * 3600)
        sharedDefaults?.set(expiry, forKey: "widgetCookieExpiry")
    }

    // MARK: - Authenticated Request

    /// Performs an authenticated GET request, logging in if necessary.
    /// Returns decoded JSON or nil on failure.
    static func fetch<T: Decodable>(_ path: String, as type: T.Type) async -> T? {
        let urlString = baseURL + path
        guard let url = URL(string: urlString) else { return nil }

        // Try with cached cookie first
        if let cookieHeader = cachedCookieHeader() {
            var request = URLRequest(url: url)
            request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
            request.setValue("application/json", forHTTPHeaderField: "Accept")

            if let result = try? await performRequest(request, as: type) {
                return result
            }
            // Cookie rejected, clear cache and re-login
            sharedDefaults?.removeObject(forKey: "widgetCookieHeader")
        }

        // Need to login
        guard let creds = loadCredentials() else { return nil }
        guard let cookie = await login(username: creds.username, password: creds.password) else {
            return nil
        }
        cacheCookieHeader(cookie)

        // Retry with fresh cookie
        var request = URLRequest(url: url)
        request.setValue(cookie, forHTTPHeaderField: "Cookie")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        return try? await performRequest(request, as: type)
    }

    /// Logs in and returns the raw Set-Cookie value to use in subsequent requests.
    private static func login(username: String, password: String) async -> String? {
        guard let url = URL(string: baseURL + "/api/auth/login") else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let body = ["username": username, "password": password]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        // Use ephemeral session so cookies don't leak into shared storage
        let config = URLSessionConfiguration.ephemeral
        let session = URLSession(configuration: config)

        guard let (_, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse,
              http.statusCode == 200 else {
            return nil
        }

        // Extract Set-Cookie header and build a Cookie header from it
        let headerFields = http.allHeaderFields as? [String: String] ?? [:]
        let cookies = HTTPCookie.cookies(withResponseHeaderFields: headerFields, for: url)
        guard !cookies.isEmpty else { return nil }

        // Build "name=value; name2=value2" format for the Cookie request header
        let cookieHeader = cookies.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
        return cookieHeader
    }

    private static func performRequest<T: Decodable>(
        _ request: URLRequest,
        as type: T.Type
    ) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.userAuthenticationRequired)
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: data)
    }
}
