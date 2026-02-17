/**
 * Purpose:
 *   Thin route wrappers that extract URL params and forward them to the
 *   main Index page component with the correct initial tab and file selection.
 *
 * Responsibilities:
 *   - Extract :id param from the URL
 *   - Render the Index page with the "files" tab pre-selected and the file focused
 *
 * Key dependencies:
 *   - react-router-dom: useParams for URL parameter extraction
 *   - Index (pages): main tabbed page component
 *
 * Side effects:
 *   - None
 *
 * Notes:
 *   - Both DocumentRoute and TranscriptRoute resolve to the same "files" tab.
 *     Transcripts are treated as files in the current data model.
 */
import { useParams } from 'react-router-dom';
import Index from './pages/Index';

/** Opens the files tab with a specific document pre-selected by URL :id param. */
export const DocumentRoute = () => {
    const { id } = useParams();
    return <Index initialTab="files" initialFileId={id} />;
};

/** Opens the files tab for a transcript; delegates to the same view as DocumentRoute. */
export const TranscriptRoute = () => {
    const { id } = useParams();
    // Transcripts are also in FilesPage
    return <Index initialTab="files" initialFileId={id} />;
};
