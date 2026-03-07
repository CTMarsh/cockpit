import SwiftUI

struct ProxmoxView: View {
    @ObservedObject private var service = ProxmoxService.shared
    @State private var confirmAction: VMAction?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let error = service.error {
                    ErrorBanner(message: error)
                        .padding(.horizontal)
                }

                if let status = service.status, !status.configured {
                    HStack {
                        Image(systemName: "exclamationmark.triangle")
                            .foregroundStyle(Theme.warning)
                        Text("Proxmox not configured on server")
                            .foregroundStyle(Theme.textMuted)
                    }
                    .padding()
                } else if service.isLoading && service.nodes.isEmpty {
                    LoadingView()
                } else {
                    // Nodes
                    if !service.nodes.isEmpty {
                        SectionTitle(text: "Nodes")

                        LazyVStack(spacing: 10) {
                            ForEach(service.nodes) { node in
                                NodeCard(node: node)
                            }
                        }
                        .padding(.horizontal)
                    }

                    // VMs & Containers
                    if !service.vms.isEmpty {
                        SectionTitle(text: "VMs & Containers")

                        LazyVStack(spacing: 8) {
                            ForEach(service.vms) { vm in
                                VMRow(vm: vm) { action in
                                    confirmAction = VMAction(vmid: vm.vmid, action: action, node: vm.node, type: vm.type, name: vm.name)
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .background(Theme.background)
        .navigationTitle("Proxmox")
        .refreshable {
            await service.fetchStatus()
            await service.fetchNodes()
            await service.fetchVMs()
        }
        .onAppear { service.startPolling() }
        .onDisappear { service.stopPolling() }
        .confirmationDialog(
            "Confirm Action",
            isPresented: Binding(get: { confirmAction != nil }, set: { if !$0 { confirmAction = nil } }),
            titleVisibility: .visible
        ) {
            if let action = confirmAction {
                Button("\(action.action.capitalized) \(action.name)?") {
                    Task {
                        await service.vmAction(vmid: action.vmid, action: action.action, node: action.node, type: action.type)
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
        }
    }
}

private struct VMAction {
    let vmid: Int
    let action: String
    let node: String
    let type: String
    let name: String
}

private struct NodeCard: View {
    let node: ProxmoxNode

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(node.node)
                    .font(.headline)
                    .foregroundStyle(Theme.text)
                Spacer()
                StatusBadge(text: node.status, color: node.status == "online" ? Theme.success : Theme.danger)
            }

            HStack(spacing: 16) {
                MetricBar(label: "CPU", value: node.cpuPercent / 100)
                MetricBar(label: "MEM", value: node.memPercent / 100)
            }
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border, lineWidth: 1))
    }
}

private struct VMRow: View {
    let vm: ProxmoxVM
    let onAction: (String) -> Void

    private var statusColor: Color {
        switch vm.status {
        case "running": Theme.success
        case "stopped": Theme.danger
        default: Theme.textMuted
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(statusColor)
                .frame(width: 10, height: 10)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(vm.name)
                        .font(.body.weight(.medium))
                        .foregroundStyle(Theme.text)
                    Text(vm.type == "qemu" ? "VM" : "CT")
                        .font(.caption2)
                        .foregroundStyle(Theme.textMuted)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Theme.border)
                        .clipShape(Capsule())
                }
                Text("\(vm.node) · VMID \(vm.vmid)")
                    .font(.caption)
                    .foregroundStyle(Theme.textMuted)
            }

            Spacer()

            if vm.status == "running" {
                Menu {
                    Button { onAction("reboot") } label: { Label("Reboot", systemImage: "arrow.clockwise") }
                    Button { onAction("shutdown") } label: { Label("Shutdown", systemImage: "power") }
                    Button(role: .destructive) { onAction("stop") } label: { Label("Force Stop", systemImage: "stop.fill") }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(Theme.accent)
                }
            } else {
                Button {
                    onAction("start")
                } label: {
                    Image(systemName: "play.fill")
                        .foregroundStyle(Theme.success)
                }
            }
        }
        .padding(12)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Theme.border, lineWidth: 1))
    }
}

private struct MetricBar: View {
    let label: String
    let value: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(Theme.textMuted)
                Spacer()
                Text("\(Int(value * 100))%")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(Theme.text)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Theme.border)
                    RoundedRectangle(cornerRadius: 3)
                        .fill(value > 0.8 ? Theme.danger : Theme.accent)
                        .frame(width: geo.size.width * min(value, 1))
                }
            }
            .frame(height: 6)
        }
    }
}

private struct SectionTitle: View {
    let text: String

    var body: some View {
        HStack {
            Text(text)
                .font(.headline)
                .foregroundStyle(Theme.text)
            Spacer()
        }
        .padding(.horizontal)
        .padding(.top, 4)
    }
}
