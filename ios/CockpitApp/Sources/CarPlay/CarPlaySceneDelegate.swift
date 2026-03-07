import CarPlay
import UIKit

class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    var interfaceController: CPInterfaceController?
    private var refreshTimer: Timer?

    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                  didConnect interfaceController: CPInterfaceController) {
        self.interfaceController = interfaceController
        let tabBar = CPTabBarTemplate(templates: [
            makeStatusTab(),
            makeActionsTab(),
            makeAlertsTab()
        ])
        interfaceController.setRootTemplate(tabBar, animated: true, completion: nil)

        // Auto-refresh every 60 seconds while connected
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            self?.refreshAllTabs()
        }
    }

    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                  didDisconnect interfaceController: CPInterfaceController) {
        refreshTimer?.invalidate()
        refreshTimer = nil
        self.interfaceController = nil
    }

    // MARK: - Status Tab

    private func makeStatusTab() -> CPListTemplate {
        let items = [
            CPListItem(text: "Loading...", detailText: "Fetching status")
        ]
        let section = CPListSection(items: items)
        let template = CPListTemplate(title: "Status", sections: [section])
        template.tabImage = UIImage(systemName: "chart.bar.fill")

        Task { @MainActor in
            await refreshStatus(template: template)
        }

        return template
    }

    // MARK: - Actions Tab

    private func makeActionsTab() -> CPListTemplate {
        let items = [CPListItem(text: "Loading...", detailText: "Fetching devices")]
        let section = CPListSection(items: items)
        let template = CPListTemplate(title: "Actions", sections: [section])
        template.tabImage = UIImage(systemName: "bolt.fill")

        Task { @MainActor in
            await refreshActions(template: template)
        }

        return template
    }

    // MARK: - Alerts Tab

    private func makeAlertsTab() -> CPListTemplate {
        let items = [CPListItem(text: "Loading...", detailText: "Fetching alerts")]
        let section = CPListSection(items: items)
        let template = CPListTemplate(title: "Alerts", sections: [section])
        template.tabImage = UIImage(systemName: "bell.fill")

        Task { @MainActor in
            await refreshAlerts(template: template)
        }

        return template
    }

    // MARK: - Refresh Logic

    @MainActor
    func refreshStatus(template: CPListTemplate) async {
        // Try cache first for instant display
        let cache = CacheManager.shared
        var cluster: ClusterMetrics?
        var services: [ServiceStatus] = []

        // Fetch cluster metrics
        do {
            let metrics: ClusterMetrics = try await APIClient.shared.request(path: "/api/sysmon/cluster")
            cluster = metrics
        } catch {
            // Fall back to cached data
            if let data = cache.getColdStale(endpoint: "/api/sysmon/cluster") {
                cluster = try? JSONDecoder().decode(ClusterMetrics.self, from: data)
            }
        }

        // Fetch services
        do {
            services = try await APIClient.shared.request(path: "/api/homelab/services")
        } catch {
            if let data = cache.getColdStale(endpoint: "/api/homelab/services") {
                services = (try? JSONDecoder().decode([ServiceStatus].self, from: data)) ?? []
            }
        }

        let items = CarPlayTemplates.buildStatusItems(
            cluster: cluster,
            services: services
        )

        let section = CPListSection(items: items)
        template.updateSections([section])
    }

    @MainActor
    func refreshActions(template: CPListTemplate) async {
        var devices: [WolDevice] = []

        do {
            let response: WolDevicesResponse = try await APIClient.shared.request(path: "/api/wol/devices")
            devices = response.devices
        } catch {
            if let data = CacheManager.shared.getColdStale(endpoint: "/api/wol/devices") {
                devices = (try? JSONDecoder().decode(WolDevicesResponse.self, from: data))?.devices ?? []
            }
        }

        let items = CarPlayTemplates.buildWoLItems(devices: devices, delegate: self)
        let section = CPListSection(items: items.isEmpty
            ? [CPListItem(text: "No devices", detailText: "Add WoL devices in the app")]
            : items)
        template.updateSections([section])
    }

    @MainActor
    func refreshAlerts(template: CPListTemplate) async {
        var alerts: [AlertHistory] = []

        do {
            let response: AlertHistoryResponse = try await APIClient.shared.request(
                path: "/api/alerts/history?limit=10"
            )
            alerts = response.history
        } catch {
            if let data = CacheManager.shared.getColdStale(endpoint: "/api/alerts/history") {
                alerts = (try? JSONDecoder().decode(AlertHistoryResponse.self, from: data))?.history ?? []
            }
        }

        let items = CarPlayTemplates.buildAlertItems(alerts: alerts)
        let section = CPListSection(items: items.isEmpty
            ? [CPListItem(text: "No alerts", detailText: "All systems nominal")]
            : items)
        template.updateSections([section])
    }

    // MARK: - WoL Wake Action

    @MainActor
    func wakeDevice(_ device: WolDevice) {
        guard let controller = interfaceController else { return }

        let alert = CPAlertTemplate(
            titleVariants: ["Wake \(device.name)?"],
            actions: [
                CPAlertAction(title: "Wake", style: .default) { [weak self] _ in
                    controller.dismissTemplate(animated: true, completion: nil)
                    Task { @MainActor in
                        let success = await WolService.shared.wake(id: device.id)
                        self?.showWakeResult(deviceName: device.name, success: success)
                    }
                },
                CPAlertAction(title: "Cancel", style: .cancel) { _ in
                    controller.dismissTemplate(animated: true, completion: nil)
                }
            ]
        )
        controller.presentTemplate(alert, animated: true, completion: nil)
    }

    @MainActor
    private func showWakeResult(deviceName: String, success: Bool) {
        guard let controller = interfaceController else { return }

        let message = success
            ? "Wake packet sent to \(deviceName)"
            : "Failed to wake \(deviceName)"

        let alert = CPAlertTemplate(
            titleVariants: [message],
            actions: [
                CPAlertAction(title: "OK", style: .default) { _ in
                    controller.dismissTemplate(animated: true, completion: nil)
                }
            ]
        )
        controller.presentTemplate(alert, animated: true, completion: nil)
    }

    // MARK: - Refresh All

    private func refreshAllTabs() {
        guard let tabBar = interfaceController?.rootTemplate as? CPTabBarTemplate else { return }
        for template in tabBar.templates {
            guard let list = template as? CPListTemplate else { continue }
            switch list.title {
            case "Status":
                Task { @MainActor in await refreshStatus(template: list) }
            case "Actions":
                Task { @MainActor in await refreshActions(template: list) }
            case "Alerts":
                Task { @MainActor in await refreshAlerts(template: list) }
            default:
                break
            }
        }
    }
}
