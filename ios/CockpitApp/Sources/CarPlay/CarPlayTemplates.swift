import CarPlay

enum CarPlayTemplates {

    // MARK: - Status Items

    static func buildStatusItems(
        cluster: ClusterMetrics?,
        services: [ServiceStatus]
    ) -> [CPListItem] {
        var items: [CPListItem] = []

        // Service health summary
        let total = services.count
        let upCount = services.filter { $0.status == "up" }.count
        let serviceItem = CPListItem(
            text: "Services: \(upCount)/\(total) up",
            detailText: total == 0 ? "No services configured" : (upCount == total ? "All healthy" : "\(total - upCount) down")
        )
        serviceItem.setImage(UIImage(systemName: upCount == total ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"))
        items.append(serviceItem)

        // Cluster metrics
        if let cluster, cluster.configured {
            if let cpu = cluster.cpu {
                let cpuItem = CPListItem(
                    text: "CPU: \(String(format: "%.0f", cpu.usedPercent))%",
                    detailText: "\(cpu.cores) cores"
                )
                cpuItem.setImage(UIImage(systemName: "cpu"))
                items.append(cpuItem)
            }

            if let memory = cluster.memory {
                let memItem = CPListItem(
                    text: "Memory: \(String(format: "%.0f", memory.percent))%",
                    detailText: "\(String(format: "%.1f", memory.usedGb))/\(String(format: "%.1f", memory.totalGb)) GB"
                )
                memItem.setImage(UIImage(systemName: "memorychip"))
                items.append(memItem)
            }

            if let nodeCount = cluster.nodeCount {
                let online = cluster.onlineCount ?? nodeCount
                let nodeItem = CPListItem(
                    text: "Nodes: \(online)/\(nodeCount)",
                    detailText: online == nodeCount ? "All online" : "\(nodeCount - online) offline"
                )
                nodeItem.setImage(UIImage(systemName: "server.rack"))
                items.append(nodeItem)
            }

            if let disk = cluster.disk {
                let diskItem = CPListItem(
                    text: "Disk: \(String(format: "%.0f", disk.percent))%",
                    detailText: "\(String(format: "%.1f", disk.usedGb))/\(String(format: "%.1f", disk.totalGb)) GB"
                )
                diskItem.setImage(UIImage(systemName: "internaldrive"))
                items.append(diskItem)
            }
        } else {
            let unconfigured = CPListItem(
                text: "Cluster",
                detailText: cluster == nil ? "Unable to connect" : "Not configured"
            )
            unconfigured.setImage(UIImage(systemName: "xmark.circle"))
            items.append(unconfigured)
        }

        return items
    }

    // MARK: - WoL Items

    static func buildWoLItems(
        devices: [WolDevice],
        delegate: CarPlaySceneDelegate
    ) -> [CPListItem] {
        return devices.map { device in
            let statusText: String
            if let online = device.online {
                statusText = online ? "Online" : "Offline"
            } else {
                statusText = device.mac
            }

            let item = CPListItem(
                text: device.name,
                detailText: statusText
            )
            item.setImage(UIImage(systemName: device.online == true ? "bolt.circle.fill" : "bolt.circle"))
            item.handler = { [weak delegate] _, completion in
                let d = delegate
                Task { @MainActor in
                    d?.wakeDevice(device)
                }
                completion()
            }
            return item
        }
    }

    // MARK: - Alert Items

    static func buildAlertItems(alerts: [AlertHistory]) -> [CPListItem] {
        return alerts.prefix(10).map { alert in
            let timeText = formatAlertTime(alert.firedAt)
            let item = CPListItem(
                text: alert.ruleName,
                detailText: "\(alert.metricType) \(String(format: "%.0f", alert.value)) > \(String(format: "%.0f", alert.threshold)) - \(timeText)"
            )
            item.setImage(UIImage(systemName: "bell.badge.fill"))
            return item
        }
    }

    // MARK: - Helpers

    private static func formatAlertTime(_ isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: isoString) else {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: isoString) else { return isoString }
            return relativeTime(from: date)
        }
        return relativeTime(from: date)
    }

    private static func relativeTime(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        return "\(Int(interval / 86400))d ago"
    }
}
