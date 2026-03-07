import AppIntents

struct VMControlIntent: AppIntent {
    static let title: LocalizedStringResource = "Control Proxmox VM"
    static let description = IntentDescription("Start, stop, or reboot a Proxmox virtual machine")
    static let openAppWhenRun = false

    @Parameter(title: "VM Name")
    var vmName: String

    @Parameter(title: "Action")
    var action: VMAction

    enum VMAction: String, AppEnum {
        case start, stop, reboot

        nonisolated(unsafe) static var typeDisplayRepresentation = TypeDisplayRepresentation("VM Action")
        nonisolated(unsafe) static var caseDisplayRepresentations: [VMAction: DisplayRepresentation] = [
            .start: "Start",
            .stop: "Stop",
            .reboot: "Reboot"
        ]
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let api = APIClient.shared
        do {
            // Fetch all Proxmox nodes to find the VM
            let nodesResponse: VMIntentNodesResponse = try await api.request(path: "/api/proxmox/nodes")

            for node in nodesResponse.nodes {
                let vmsResponse: VMIntentVMsResponse = try await api.request(
                    path: "/api/proxmox/nodes/\(node.node)/qemu"
                )

                guard let vm = vmsResponse.vms.first(where: {
                    $0.name.localizedCaseInsensitiveContains(vmName)
                }) else {
                    continue
                }

                // Map action to Proxmox API endpoint
                let endpoint: String
                switch action {
                case .start:
                    endpoint = "start"
                case .stop:
                    endpoint = "stop"
                case .reboot:
                    endpoint = "reboot"
                }

                let _: VMIntentActionResponse = try await api.request(
                    path: "/api/proxmox/nodes/\(node.node)/qemu/\(vm.vmid)/status/\(endpoint)",
                    method: "POST"
                )

                return .result(dialog: "VM '\(vm.name)' \(endpoint) command sent on \(node.node).")
            }

            return .result(dialog: "No VM found matching '\(vmName)'.")
        } catch {
            return .result(dialog: "Failed to \(action.rawValue) VM: \(error.localizedDescription)")
        }
    }
}

// MARK: - Response Models (prefixed to avoid conflict with ProxmoxModels.swift)

private struct VMIntentNodesResponse: Codable {
    let nodes: [VMIntentNodeEntry]
}

private struct VMIntentNodeEntry: Codable {
    let node: String
}

private struct VMIntentVMsResponse: Codable {
    let vms: [VMIntentVMEntry]
}

private struct VMIntentVMEntry: Codable {
    let vmid: Int
    let name: String
}

private struct VMIntentActionResponse: Codable {
    let ok: Bool?
}
