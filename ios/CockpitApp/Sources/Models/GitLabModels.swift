import Foundation

// MARK: - Status

struct GitLabStatusResponse: Decodable {
    let configured: Bool
    let connected: Bool?
    let version: String?
}

// MARK: - List Response Wrapper

struct GitLabListResponse<T: Decodable>: Decodable {
    let items: [T]
    let totalPages: Int?
    let total: Int?
}

// MARK: - User

struct GitLabUser: Decodable {
    let name: String
    let avatarUrl: String?
}

// MARK: - Project

struct GitLabProject: Decodable, Identifiable {
    let id: Int
    let name: String
    let nameWithNamespace: String
    let description: String?
    let webUrl: String
    let lastActivityAt: Date?
    let defaultBranch: String?
    let starCount: Int?
    let forksCount: Int?
    let openIssuesCount: Int?
}

// MARK: - Issue

struct GitLabIssue: Decodable, Identifiable {
    let id: Int
    let iid: Int
    let title: String
    let state: String
    let createdAt: Date?
    let updatedAt: Date?
    let labels: [String]
    let assignee: GitLabUser?
    let author: GitLabUser
    let webUrl: String
    let description: String?
}

// MARK: - Merge Request

struct GitLabMR: Decodable, Identifiable {
    let id: Int
    let iid: Int
    let title: String
    let state: String
    let sourceBranch: String
    let targetBranch: String
    let author: GitLabUser
    let createdAt: Date?
    let updatedAt: Date?
    let mergeStatus: String?
    let webUrl: String
    let hasConflicts: Bool?
    let userNotesCount: Int?
}

// MARK: - Pipeline

struct GitLabPipeline: Decodable, Identifiable {
    let id: Int
    let status: String
    let ref: String
    let sha: String
    let createdAt: Date?
    let updatedAt: Date?
    let webUrl: String
}

// MARK: - Job

struct GitLabJob: Decodable, Identifiable {
    let id: Int
    let name: String
    let stage: String
    let status: String
    let createdAt: Date?
    let startedAt: Date?
    let finishedAt: Date?
    let duration: Double?
    let webUrl: String
}

// MARK: - Release

struct GitLabRelease: Decodable, Identifiable {
    var id: String { tagName }
    let tagName: String
    let name: String?
    let description: String?
    let createdAt: Date?
    let releasedAt: Date?
}

// MARK: - Label

struct GitLabLabel: Decodable, Identifiable {
    let id: Int
    let name: String
    let color: String
    let textColor: String?
}

// MARK: - Repository Tree

struct GitLabTreeItem: Decodable, Identifiable {
    let id: String
    let name: String
    let type: String
    let path: String
    let mode: String?
}

// MARK: - Note (Comment)

struct GitLabNote: Decodable, Identifiable {
    let id: Int
    let body: String
    let author: GitLabUser
    let createdAt: Date?
}

// MARK: - Changes / Diff

struct GitLabChangesResponse: Decodable {
    let changes: [GitLabDiffChange]
    let changesCount: Int?
}

struct GitLabDiffChange: Decodable, Identifiable {
    var id: String { oldPath + newPath }
    let oldPath: String
    let newPath: String
    let newFile: Bool?
    let deletedFile: Bool?
    let diff: String
}

// MARK: - Job Log

struct GitLabJobLogResponse: Decodable {
    let log: String
}

// MARK: - Request Bodies

struct CreateIssueBody: Encodable {
    let title: String
    let description: String?
    let labels: String?
}

struct UpdateIssueBody: Encodable {
    let stateEvent: String

    enum CodingKeys: String, CodingKey {
        case stateEvent = "state_event"
    }
}

struct CreateNoteBody: Encodable {
    let body: String
}
