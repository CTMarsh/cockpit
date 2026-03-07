import Foundation

@MainActor
final class WebSocketClient: ObservableObject {
    @Published var isConnected = false
    @Published var lastMessage: String?

    private var webSocketTask: URLSessionWebSocketTask?
    private let session: URLSession
    private var onMessage: ((String) -> Void)?

    init() {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.httpShouldSetCookies = true
        session = URLSession(configuration: config)
    }

    func connect(docId: String, onMessage: @escaping (String) -> Void) {
        disconnect()
        self.onMessage = onMessage

        let baseURL = APIClient.shared.baseURL
            .replacingOccurrences(of: "https://", with: "wss://")
            .replacingOccurrences(of: "http://", with: "ws://")

        guard let url = URL(string: "\(baseURL)/api/ws?docId=\(docId)") else { return }

        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()
        isConnected = true
        receiveMessage()
    }

    func disconnect() {
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
    }

    func send(content: String, docId: String) {
        guard let task = webSocketTask else { return }
        let json = """
        {"type":"update","content":"\(content.replacingOccurrences(of: "\"", with: "\\\"").replacingOccurrences(of: "\n", with: "\\n"))","docId":"\(docId)"}
        """
        task.send(.string(json)) { _ in }
    }

    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            Task { @MainActor in
                guard let self else { return }
                switch result {
                case .success(let message):
                    switch message {
                    case .string(let text):
                        self.lastMessage = text
                        self.onMessage?(text)
                    default:
                        break
                    }
                    self.receiveMessage()
                case .failure:
                    self.isConnected = false
                }
            }
        }
    }
}
