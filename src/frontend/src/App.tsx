/**
 * Purpose:
 *   Root application component that assembles providers, routing, and
 *   authentication guards for the entire GodMode SPA.
 *
 * Responsibilities:
 *   - Configure React Query with sensible defaults (30s stale, 1 retry)
 *   - Wrap the component tree with AuthProvider, ProjectProvider, and QueryClientProvider
 *   - Define all application routes under the /app basename
 *   - Enforce authentication via the AuthGuard layout route
 *
 * Key dependencies:
 *   - react-router-dom: client-side routing under /app basename
 *   - @tanstack/react-query: server state management (QueryClient)
 *   - AuthContext: session state and auth methods (login, logout, etc.)
 *   - ProjectContext: active project selection and persistence
 *
 * Side effects:
 *   - None beyond provider initialisation (auth session check, project fetch)
 *
 * Notes:
 *   - BrowserRouter uses basename="/app" so all routes are prefixed with /app
 *   - Unauthenticated users are redirected to /login; unknown paths to /dashboard
 *   - refetchOnWindowFocus is disabled globally to reduce unnecessary requests
 */
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/layout/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import SotPage from './pages/SotPage';
import TimelinePage from './pages/TimelinePage';
import ContactsPage from './pages/ContactsPage';
import TeamAnalysisPage from './pages/TeamAnalysisPage';
import FilesPage from './pages/FilesPage';
import EmailsPage from './pages/EmailsPage';
import GraphPage from './pages/GraphPage';
import CostsPage from './pages/CostsPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import ProjectsPage from './pages/ProjectsPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import CompaniesPage from './pages/CompaniesPage';
import UserSettingsPage from './pages/UserSettingsPage';
import { ProjectProvider } from './contexts/ProjectContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Route guard that renders child routes only when the user is authenticated.
 * While the auth state is loading, displays a centered spinner.
 * If not authenticated, redirects to /login.
 */
function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProjectProvider>
          <BrowserRouter basename="/app">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<AuthGuard />}>
                <Route element={<Layout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/sot" element={<SotPage />} />
                  <Route path="/timeline" element={<TimelinePage />} />
                  <Route path="/contacts" element={<ContactsPage />} />
                  <Route path="/team-analysis" element={<TeamAnalysisPage />} />
                  <Route path="/files" element={<FilesPage />} />
                  <Route path="/emails" element={<EmailsPage />} />
                  <Route path="/graph" element={<GraphPage />} />
                  <Route path="/costs" element={<CostsPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/companies" element={<CompaniesPage />} />
                  <Route path="/user-settings" element={<UserSettingsPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </ProjectProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
