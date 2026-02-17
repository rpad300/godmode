import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/layout/Layout';
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProjectProvider>
      <BrowserRouter basename="/app">
        <Routes>
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
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ProjectProvider>
    </QueryClientProvider>
  );
}
