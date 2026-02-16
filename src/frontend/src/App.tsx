import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { DocumentRoute, TranscriptRoute } from "./RouteWrappers";

const queryClient = new QueryClient();

import { ProjectProvider } from "./contexts/ProjectContext";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ProjectProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />

            {/* Tab Routes */}
            <Route path="/dashboard" element={<Index initialTab="dashboard" />} />
            <Route path="/chat" element={<Index initialTab="chat" />} />
            <Route path="/sot" element={<Index initialTab="sot" />} />
            <Route path="/timeline" element={<Index initialTab="timeline" />} />
            <Route path="/contacts" element={<Index initialTab="contacts" />} />
            <Route path="/team-analysis" element={<Index initialTab="team-analysis" />} />
            <Route path="/files" element={<Index initialTab="files" />} />
            <Route path="/emails" element={<Index initialTab="emails" />} />
            <Route path="/graph" element={<Index initialTab="graph" />} />
            <Route path="/costs" element={<Index initialTab="costs" />} />
            <Route path="/history" element={<Index initialTab="history" />} />
            <Route path="/projects" element={<Index initialTab="projects" />} />
            <Route path="/companies" element={<Index initialTab="companies" />} />
            <Route path="/settings" element={<Index initialTab="settings" />} />
            <Route path="/user-settings" element={<Index initialTab="user-settings" />} />
            <Route path="/admin" element={<Index initialTab="admin" />} />
            <Route path="/profile" element={<Index initialTab="profile" />} />

            {/* Deep Links */}
            <Route path="/documents/:id" element={<DocumentRoute />} />
            <Route path="/transcripts/:id" element={<TranscriptRoute />} />
            <Route path="/emails/:id" element={<Index initialTab="emails" />} />
            <Route path="/chat/:id" element={<Index initialTab="chat" />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ProjectProvider>
  </QueryClientProvider>
);

export default App;
