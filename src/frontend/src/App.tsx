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
import { lazy, Suspense, Component } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Loader2, ShieldAlert, AlertTriangle, RefreshCw } from 'lucide-react';
import { Layout } from './components/layout/Layout';
import { RequireProject } from './components/layout/RequireProject';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useUser } from './hooks/useUser';
import { ProjectProvider } from './contexts/ProjectContext';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const SotPage = lazy(() => import('./pages/SotPage'));
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const ContactsPage = lazy(() => import('./pages/ContactsPage'));
const TeamAnalysisPage = lazy(() => import('./pages/TeamAnalysisPage'));
const FilesPage = lazy(() => import('./pages/FilesPage'));
const EmailsPage = lazy(() => import('./pages/EmailsPage'));
const ConversationsPage = lazy(() => import('./pages/ConversationsPage'));
const GraphPage = lazy(() => import('./pages/GraphPage'));
const CostsPage = lazy(() => import('./pages/CostsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SprintsPage = lazy(() => import('./pages/SprintsPage'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const UserSettingsPage = lazy(() => import('./pages/UserSettingsPage'));
const OptimizationsPage = lazy(() => import('./pages/OptimizationsPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const LoginPage = lazy(() => import('./pages/LoginPage'));

function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

interface EBState { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 text-center p-8 bg-background">
          <AlertTriangle className="h-12 w-12 text-destructive/70" />
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground max-w-md">{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

function AdminGuard() {
  const { user, isLoading } = useUser();
  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (user?.role !== 'superadmin' && user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
        <ShieldAlert className="h-12 w-12 text-destructive/60" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground max-w-md">You need administrator privileges to access this page.</p>
        <a href="/dashboard" className="text-sm text-primary underline">Back to Dashboard</a>
      </div>
    );
  }
  return <Outlet />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ProjectProvider>
            <BrowserRouter basename="/">
              <Suspense fallback={<PageSpinner />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route element={<AuthGuard />}>
                    <Route element={<Layout />}>
                      <Route index element={<Navigate to="/dashboard" replace />} />
                      <Route element={<RequireProject />}>
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/chat" element={<ChatPage />} />
                        <Route path="/sot" element={<SotPage />} />
                        <Route path="/timeline" element={<TimelinePage />} />
                        <Route path="/contacts" element={<ContactsPage />} />
                        <Route path="/team-analysis" element={<TeamAnalysisPage />} />
                        <Route path="/files" element={<FilesPage />} />
                        <Route path="/emails" element={<EmailsPage />} />
                        <Route path="/conversations" element={<ConversationsPage />} />
                        <Route path="/graph" element={<GraphPage />} />
                        <Route path="/costs" element={<CostsPage />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/sprints" element={<SprintsPage />} />
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/optimizations" element={<OptimizationsPage />} />
                        <Route path="/search" element={<SearchPage />} />
                      </Route>
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/user-settings" element={<UserSettingsPage />} />
                      <Route path="/projects" element={<ProjectsPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/companies" element={<CompaniesPage />} />
                      <Route element={<AdminGuard />}>
                        <Route path="/admin" element={<AdminPage />} />
                      </Route>
                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ProjectProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
