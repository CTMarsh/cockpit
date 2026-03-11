import Foundation

struct AnsiblePlaybooksResponse: Decodable {
    let playbooks: [String]
}

struct AnsibleRunsResponse: Decodable {
    let runs: [AnsibleRun]
}

struct AnsibleRunResponse: Decodable {
    let run: AnsibleRun
}

struct AnsibleRun: Decodable, Identifiable {
    let id: Int
    let playbook: String
    let tags: String?
    let extraVars: String?
    let dryRun: Bool
    let status: String
    let output: String?
    let exitCode: Int?
    let startedAt: String?
    let completedAt: String?

    var statusColor: String {
        switch status {
        case "success": "success"
        case "failed": "failed"
        case "running": "running"
        default: "pending"
        }
    }
}

struct RunPlaybookBody: Encodable {
    let playbook: String
    let tags: String?
    let extraVars: String?
    let dryRun: Bool?
}

struct RunPlaybookResponse: Decodable {
    let ok: Bool
    let run: AnsibleRun?
}
