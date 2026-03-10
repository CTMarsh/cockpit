import SwiftUI

struct ContentView: View {
    @EnvironmentObject var connectivity: WatchConnectivityManager
    @EnvironmentObject var api: WatchAPIClient

    var body: some View {
        if api.isAuthenticated {
            NavigationStack {
                TabView {
                    WatchDashboardPage()
                    WatchServicesPage()
                    WatchClusterPage()
                    WatchWoLPage()
                    WatchAlertsPage()
                    WatchCIPage()
                    WatchVMsPage() // Last tab — scrollable per Apple HIG
                }
                .tabViewStyle(.verticalPage)
            }
        } else {
            NavigationStack {
                WatchLoginView()
            }
        }
    }
}
