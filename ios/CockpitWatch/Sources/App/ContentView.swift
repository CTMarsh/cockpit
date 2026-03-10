import SwiftUI

struct ContentView: View {
    @EnvironmentObject var connectivity: WatchConnectivityManager
    @EnvironmentObject var api: WatchAPIClient

    var body: some View {
        if api.isAuthenticated {
            TabView {
                WatchDashboardView()
                WatchServicesView()
                WatchClusterView()
                WatchWoLView()
                WatchAlertsView()
                WatchVMsView()
            }
            .tabViewStyle(.verticalPage)
        } else {
            NavigationStack {
                WatchLoginView()
            }
        }
    }
}
