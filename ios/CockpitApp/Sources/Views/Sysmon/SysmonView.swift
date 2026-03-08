import SwiftUI

struct SysmonView: View {
    @ObservedObject private var service = SysmonService.shared
    @State private var selectedTab = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if service.isLoading && service.cluster == nil {
                    LoadingView()
                } else if let cluster = service.cluster, !cluster.configured {
                    VStack(spacing: 12) {
                        Image(systemName: "chart.bar.xaxis")
                            .font(.system(size: 48))
                            .foregroundStyle(Theme.textMuted)
                        Text("Cluster monitoring unavailable")
                            .foregroundStyle(Theme.textMuted)
                        Text("KUBECONFIG not configured on server")
                            .font(.caption)
                            .foregroundStyle(Theme.textMuted)
                    }
                    .padding(.top, 60)
                } else if let cluster = service.cluster {
                    // Cluster overview
                    HStack(spacing: 12) {
                        ClusterStatCard(
                            title: "Nodes",
                            value: "\(cluster.onlineCount ?? 0)/\(cluster.nodeCount ?? 0)",
                            icon: "server.rack",
                            color: Theme.accent
                        )
                        if let cpu = cluster.cpu {
                            ClusterStatCard(
                                title: "CPU",
                                value: "\(Int(cpu.usedPercent))%",
                                icon: "cpu",
                                color: cpu.usedPercent > 80 ? Theme.danger : Theme.success
                            )
                        }
                        if let memory = cluster.memory {
                            ClusterStatCard(
                                title: "Memory",
                                value: "\(Int(memory.percent))%",
                                icon: "memorychip",
                                color: memory.percent > 80 ? Theme.danger : Theme.success
                            )
                        }
                    }
                    .padding(.horizontal)

                    // Segment picker
                    Picker("View", selection: $selectedTab) {
                        Text("Nodes").tag(0)
                        Text("Pods").tag(1)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    if selectedTab == 0 {
                        // Node cards
                        LazyVStack(spacing: 10) {
                            ForEach(service.nodes) { node in
                                SysmonNodeCard(node: node)
                            }
                        }
                        .padding(.horizontal)
                    } else {
                        // Pod table
                        LazyVStack(spacing: 6) {
                            ForEach(service.pods) { pod in
                                PodRow(pod: pod)
                            }
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Cluster Monitor")
        .refreshable {
            await service.fetchCluster()
            await service.fetchNodes()
            await service.fetchPods()
        }
        .onAppear { service.startPolling() }
        .onDisappear { service.stopPolling() }
        .task { await service.fetchPods() }
    }
}

private struct ClusterStatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .foregroundStyle(color)
            Text(value)
                .font(.title3.bold().monospacedDigit())
                .foregroundStyle(Theme.text)
            Text(title)
                .font(.caption2)
                .foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(12)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
    }
}

private struct SysmonNodeCard: View {
    let node: SysmonNode

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(node.name)
                    .font(.headline)
                    .foregroundStyle(Theme.text)
                Spacer()
                StatusBadge(text: node.status, color: node.status == "online" ? Theme.success : Theme.danger)
            }

            HStack(spacing: 12) {
                GaugeBar(label: "CPU", percent: node.cpu.percent, cores: node.cpu.cores)
                GaugeBar(label: "MEM", percent: node.memory.percent, detail: "\(String(format: "%.1f", node.memory.usedGb))/\(String(format: "%.0f", node.memory.totalGb))G")
                GaugeBar(label: "DISK", percent: node.disk.percent, detail: nil)
            }
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
    }
}

private struct GaugeBar: View {
    let label: String
    let percent: Double
    var cores: Int? = nil
    var detail: String? = nil

    var body: some View {
        VStack(spacing: 4) {
            Text("\(Int(percent))%")
                .font(.caption.bold().monospacedDigit())
                .foregroundStyle(percent > 80 ? Theme.danger : Theme.text)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3).fill(Theme.border)
                    RoundedRectangle(cornerRadius: 3)
                        .fill(percent > 80 ? Theme.danger : Theme.accent)
                        .frame(width: geo.size.width * min(percent / 100, 1))
                }
            }
            .frame(height: 6)
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.textMuted)
        }
    }
}

private struct PodRow: View {
    let pod: K8sPod

    private var statusColor: Color {
        switch pod.status {
        case "Running": Theme.success
        case "Succeeded": Theme.success
        case "Pending": Theme.warning
        case "Failed": Theme.danger
        default: Theme.textMuted
        }
    }

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 1) {
                Text(pod.name)
                    .font(.caption)
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                Text(pod.namespace)
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)
            }

            Spacer()

            Text(pod.ready)
                .font(.caption2.monospacedDigit())
                .foregroundStyle(Theme.textMuted)

            if pod.restarts > 0 {
                Text("R:\(pod.restarts)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(pod.restarts > 5 ? Theme.danger : Theme.warning)
            }
        }
        .padding(8)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}
