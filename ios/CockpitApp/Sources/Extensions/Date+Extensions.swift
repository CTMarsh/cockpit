import Foundation

extension Date {
    /// Relative time string like "2m ago", "3h ago", "1d ago"
    var timeAgo: String {
        let interval = Date().timeIntervalSince(self)
        let seconds = Int(interval)

        if seconds < 60 {
            return "\(seconds)s ago"
        }
        let minutes = seconds / 60
        if minutes < 60 {
            return "\(minutes)m ago"
        }
        let hours = minutes / 60
        if hours < 24 {
            return "\(hours)h ago"
        }
        let days = hours / 24
        if days < 30 {
            return "\(days)d ago"
        }
        let months = days / 30
        if months < 12 {
            return "\(months)mo ago"
        }
        let years = months / 12
        return "\(years)y ago"
    }

    /// Formatted display string: "Mar 7, 2026 3:45 PM"
    var formatted: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, yyyy h:mm a"
        return formatter.string(from: self)
    }

    /// ISO 8601 string for API communication
    var iso8601: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: self)
    }
}
