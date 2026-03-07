import Foundation
import UIKit

enum PushRegistration {
    @MainActor
    static func register(token: String) async {
        let deviceName = UIDevice.current.name
        do {
            struct RegisterBody: Encodable {
                let device_token: String
                let name: String
                let platform: String
            }
            let body = RegisterBody(device_token: token, name: deviceName, platform: "ios")
            // Register via Cockpit API proxy to Notify service
            let _: GenericOKResponse = try await APIClient.shared.request(
                path: "/api/notify/devices/register",
                method: "POST",
                body: body
            )
            print("Push token registered with Notify service")
        } catch {
            print("Failed to register push token: \(error.localizedDescription)")
        }
    }
}
