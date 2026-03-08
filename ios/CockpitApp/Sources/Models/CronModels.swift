import Foundation

struct CronJobsResponse: Decodable {
    let jobs: [CronJob]
}

struct CronJob: Decodable, Identifiable {
    let id: String
    let name: String
    let schedule: String
    let command: String
    let enabled: Bool
    let createdAt: String?
    let updatedAt: String?
    let lastRun: CronRun?

    var isEnabled: Bool { enabled }
}

struct CronRun: Decodable, Identifiable {
    let id: Int
    let jobId: String?
    let startedAt: String?
    let finishedAt: String?
    let exitCode: Int?
    let output: String?

    var succeeded: Bool { exitCode == 0 }
}

struct CronRunsResponse: Decodable {
    let runs: [CronRun]
}

struct CreateCronJobBody: Encodable {
    let name: String
    let schedule: String
    let command: String
    let enabled: Bool?
}

struct UpdateCronJobBody: Encodable {
    let name: String?
    let schedule: String?
    let command: String?
    let enabled: Bool?
}

struct ManualRunResponse: Decodable {
    let ok: Bool
    let exitCode: Int?
    let output: String?
}
