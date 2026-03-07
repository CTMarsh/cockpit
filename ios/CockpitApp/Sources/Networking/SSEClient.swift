import Foundation

@MainActor
final class SSEClient: NSObject, ObservableObject, URLSessionDataDelegate, @unchecked Sendable {
    @Published var lastEvent: String?
    @Published var isConnected = false

    private var session: URLSession?
    private var task: URLSessionDataTask?
    private var buffer = ""
    private let onEvent: @Sendable @MainActor (String, String) -> Void

    init(onEvent: @escaping @Sendable @MainActor (String, String) -> Void) {
        self.onEvent = onEvent
        super.init()
    }

    func connect(path: String) {
        disconnect()
        let baseURL = APIClient.shared.baseURL
        guard let url = URL(string: baseURL + path) else { return }

        var request = URLRequest(url: url)
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 300

        let config = URLSessionConfiguration.default
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.httpShouldSetCookies = true
        config.timeoutIntervalForRequest = 300
        config.timeoutIntervalForResource = 600

        session = URLSession(configuration: config, delegate: self, delegateQueue: .main)
        task = session?.dataTask(with: request)
        task?.resume()
        isConnected = true
    }

    func disconnect() {
        task?.cancel()
        session?.invalidateAndCancel()
        task = nil
        session = nil
        buffer = ""
        isConnected = false
    }

    nonisolated func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard let chunk = String(data: data, encoding: .utf8) else { return }
        Task { @MainActor in
            self.processChunk(chunk)
        }
    }

    nonisolated func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: (any Error)?) {
        Task { @MainActor in
            self.isConnected = false
        }
    }

    private func processChunk(_ chunk: String) {
        buffer += chunk
        let lines = buffer.components(separatedBy: "\n")

        var eventType = "message"
        var eventData = ""

        for line in lines {
            if line.hasPrefix("event: ") {
                eventType = String(line.dropFirst(7))
            } else if line.hasPrefix("data: ") {
                eventData += String(line.dropFirst(6))
            } else if line.isEmpty && !eventData.isEmpty {
                lastEvent = eventData
                onEvent(eventType, eventData)
                eventType = "message"
                eventData = ""
            }
        }

        // Keep incomplete data in buffer
        if let lastNewline = buffer.lastIndex(of: "\n") {
            buffer = String(buffer[buffer.index(after: lastNewline)...])
        }
    }
}
