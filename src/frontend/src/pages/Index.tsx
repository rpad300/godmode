import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import AppLayout from '@/components/layout/AppLayout';
import DashboardPage from './DashboardPage';
import ChatPage from './ChatPage';
import SourceOfTruthPage from './SourceOfTruthPage';
import TimelinePage from './TimelinePage';
import ContactsPage from './ContactsPage';
import FilesPage from './FilesPage';
import TeamAnalysisPage from './TeamAnalysisPage';
import EmailsPage from './EmailsPage';
import GraphPage from './GraphPage';
import CostsPage from './CostsPage';
import HistoryPage from './HistoryPage';
import ProjectsPage from './ProjectsPage';
import CompaniesPage from './CompaniesPage';
import SettingsPage from './SettingsPage';
import UserSettingsPage from './UserSettingsPage';
import AdminPage from './AdminPage';
import ProfilePage from './ProfilePage';
import ImportTranscriptModal from '@/components/files/ImportTranscriptModal';
import AddEmailModal from '@/components/files/AddEmailModal';
import ImportConversationModal from '@/components/files/ImportConversationModal';
import ImportDocumentModal from '@/components/files/ImportDocumentModal';
import LandingPage from './LandingPage';
import { toast } from 'sonner';
import { TabId } from '@/types/godmode';

interface IndexProps {
  initialTab?: TabId;
  initialFileId?: string;
}

const Index = ({ initialTab = 'dashboard', initialFileId }: IndexProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Update activeTab when initialTab prop changes (e.g. from routing)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);



  // Sync URL when activeTab changes via UI
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'dashboard') {
      navigate('/');
    } else {
      navigate(`/${tab}`);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background text-foreground">Loading...</div>;
  }

  if (!session) {
    return <LandingPage onEnter={() => { }} />;
  }

  return (
    <AppLayout activeTab={activeTab} onTabChange={handleTabChange}>
      {(currentTab, onNavigate, importFileType, clearImport) => (
        <>
          {(() => {
            switch (currentTab) {
              case 'dashboard': return <DashboardPage onNavigate={onNavigate} />;
              case 'chat': return <ChatPage />;
              case 'sot': return <SourceOfTruthPage />;
              case 'timeline': return <TimelinePage />;
              case 'contacts': return <ContactsPage />;
              case 'team-analysis': return <TeamAnalysisPage />;
              case 'files': return <FilesPage initialFileId={initialFileId} />;
              case 'emails': return <EmailsPage />;
              case 'graph': return <GraphPage />;
              case 'costs': return <CostsPage />;
              case 'history': return <HistoryPage />;
              case 'projects': return <ProjectsPage />;
              case 'companies': return <CompaniesPage />;
              case 'settings': return <SettingsPage />;
              case 'user-settings': return <UserSettingsPage />;
              case 'admin': return <AdminPage />;
              case 'profile': return <ProfilePage />;
              default: return <DashboardPage />;
            }
          })()}

          <ImportDocumentModal
            open={importFileType === 'documents'}
            onClose={clearImport}
            onImport={() => { toast.success('Document imported'); clearImport(); }}
          />
          <ImportTranscriptModal
            open={importFileType === 'transcripts'}
            onClose={clearImport}
            onImport={() => { toast.success('Transcript imported'); clearImport(); }}
          />
          <AddEmailModal
            open={importFileType === 'emails'}
            onClose={clearImport}
            onImport={() => { toast.success('Email added'); clearImport(); }}
          />
          <ImportConversationModal
            open={importFileType === 'conversations'}
            onClose={clearImport}
            onImport={() => { toast.success('Conversation imported'); clearImport(); }}
          />
        </>
      )}
    </AppLayout>
  );
};

export default Index;
