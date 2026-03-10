import UIKit
import UserNotifications
@preconcurrency import WatchConnectivity

class AppDelegate: NSObject, UIApplicationDelegate, @unchecked Sendable {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = NotificationDelegate.shared
        requestNotificationPermission(application)

        // Register and schedule background refresh for widget data
        BackgroundTaskManager.shared.registerTask()
        BackgroundTaskManager.shared.scheduleRefresh()

        // Activate WatchConnectivity for credential sync
        if WCSession.isSupported() {
            WCSession.default.delegate = PhoneSessionDelegate.shared
            WCSession.default.activate()
        }

        return true
    }

    // MARK: - Notification Permission

    private func requestNotificationPermission(_ application: UIApplication) {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, error in
            if let error = error {
                print("Notification auth error: \(error.localizedDescription)")
                return
            }
            if granted {
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            }
        }
    }

    // MARK: - Device Token Registration

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("APNs device token: \(token)")

        // Store token and register with Notify service
        KeychainHelper.save(key: "deviceToken", value: token)
        Task { @MainActor in
            await PushRegistration.register(token: token)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("Failed to register for remote notifications: \(error.localizedDescription)")
    }

    // MARK: - Background Push Handling

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        completionHandler(.newData)
    }
}

// MARK: - WatchConnectivity Delegate (iPhone side)

final class PhoneSessionDelegate: NSObject, WCSessionDelegate, Sendable {
    static let shared = PhoneSessionDelegate()

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            print("WCSession activation error: \(error.localizedDescription)")
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
}

// MARK: - Notification Delegate

final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate, Sendable {
    static let shared = NotificationDelegate()

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .badge, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let module = userInfo["module"] as? String {
            Task { @MainActor in
                DeepLinkRouter.shared.navigate(to: module)
            }
        }
        completionHandler()
    }
}
