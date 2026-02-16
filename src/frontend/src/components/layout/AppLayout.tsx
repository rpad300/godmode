import { useState } from 'react';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';
import type { TabId } from '@/types/godmode';
import type { ImportFileType } from './AppSidebar';

interface AppLayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: (activeTab: TabId, onNavigate: (tab: TabId) => void, importFileType: ImportFileType | null, clearImport: () => void) => React.ReactNode;
}

const AppLayout = ({ children, activeTab, onTabChange }: AppLayoutProps) => {
  const [importFileType, setImportFileType] = useState<ImportFileType | null>(null);

  // Helper to intercept navigation and call parent handler
  const handleNavigate = (tab: TabId) => {
    onTabChange(tab);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppHeader
        onNavigate={handleNavigate}
      />
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar activeTab={activeTab} onTabChange={handleNavigate} onImportFile={setImportFileType} />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children(activeTab, handleNavigate, importFileType, () => setImportFileType(null))}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
