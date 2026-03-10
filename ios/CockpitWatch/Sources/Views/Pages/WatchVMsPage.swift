import SwiftUI
import WatchKit

/// VMs page — the LAST tab, so it can contain scrollable content per Apple HIG.
struct WatchVMsPage: View {
    @State private var vms: [ProxmoxVM] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var actionTarget: ProxmoxVM?
    @State private var pendingAction: VMAction?
    @State private var actingVmId: Int?

    private enum VMAction {
        case start, stop
        var apiAction: String { self == .start ? "start" : "stop" }
        var label: String { self == .start ? "Start" : "Stop" }
    }

    var body: some View {
        // Last tab — scrollable content is OK per Apple HIG
        ScrollView {
            VStack(spacing: 8) {
                if isLoading {
                    ProgressView().tint(Theme.accent)
                        .padding(.top, 20)
                } else if let error {
                    Image(systemName: "desktopcomputer.trianglebadge.exclamationmark")
                        .font(.title3)
                        .foregroundStyle(Theme.danger)
                    Text(error)
                        .font(.caption2)
                        .foregroundStyle(Theme.danger)
                } else if vms.isEmpty {
                    Text("No VMs found")
                        .font(.caption)
                        .foregroundStyle(Theme.textMuted)
                        .padding(.top, 20)
                } else {
                    HStack {
                        Text("VMs")
                            .font(.headline)
                            .foregroundStyle(Theme.text)
                        Spacer()
                        let running = vms.filter { $0.status == "running" }.count
                        Text("\(running)/\(vms.count)")
                            .font(.caption)
                            .foregroundStyle(Theme.success)
                    }

                    ForEach(vms) { vm in
                        vmRow(vm)
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .containerBackground(Theme.background, for: .tabView)
        .task { await fetchData() }
        .alert(confirmationTitle, isPresented: .init(
            get: { actionTarget != nil },
            set: { if !$0 { actionTarget = nil; pendingAction = nil } }
        )) {
            Button(pendingAction?.label ?? "Confirm", role: pendingAction == .stop ? .destructive : nil) {
                if let vm = actionTarget, let action = pendingAction {
                    Task { await performAction(vm: vm, action: action) }
                }
            }
            Button("Cancel", role: .cancel) {
                actionTarget = nil
                pendingAction = nil
            }
        } message: {
            if let vm = actionTarget, let action = pendingAction {
                Text("\(action.label) \(vm.name)?")
            }
        }
    }

    private var confirmationTitle: String {
        guard let action = pendingAction else { return "Confirm" }
        return "\(action.label) VM?"
    }

    private func vmRow(_ vm: ProxmoxVM) -> some View {
        HStack(spacing: 6) {
            Circle()
                .fill(vm.status == "running" ? Theme.success : Theme.textMuted.opacity(0.4))
                .frame(width: 7, height: 7)

            VStack(alignment: .leading, spacing: 1) {
                Text(vm.name)
                    .font(.caption2)
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                Text(vm.status.capitalized)
                    .font(.system(size: 9))
                    .foregroundStyle(vm.status == "running" ? Theme.success : Theme.textMuted)
            }

            Spacer()

            if actingVmId == vm.vmid {
                ProgressView()
                    .controlSize(.mini)
                    .tint(Theme.accent)
            } else {
                Button {
                    actionTarget = vm
                    pendingAction = vm.status == "running" ? .stop : .start
                } label: {
                    Image(systemName: vm.status == "running" ? "stop.fill" : "play.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(vm.status == "running" ? Theme.danger : Theme.success)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(6)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func performAction(vm: ProxmoxVM, action: VMAction) async {
        actingVmId = vm.vmid
        do {
            let body = VMActionBody(action: action.apiAction, node: vm.node, type: vm.type)
            let _: VMActionResponse = try await WatchAPIClient.shared.request(
                path: "/api/proxmox/vms/\(vm.vmid)/action",
                method: "POST",
                body: body
            )
            WKInterfaceDevice.current().play(.success)
            try? await Task.sleep(for: .seconds(2))
            await fetchData()
        } catch {
            WKInterfaceDevice.current().play(.failure)
            self.error = "\(action.label) failed"
        }
        actingVmId = nil
    }

    private func fetchData() async {
        isLoading = true
        error = nil
        do {
            let r: ProxmoxResourcesResponse = try await WatchAPIClient.shared.request(path: "/api/proxmox/resources")
            vms = r.vms.sorted { a, b in
                if a.status == b.status { return a.name < b.name }
                return a.status == "running"
            }
        } catch {
            self.error = "Cannot reach Proxmox"
        }
        isLoading = false
    }
}
