import { useParams } from 'react-router-dom';
import Index from './pages/Index';

export const DocumentRoute = () => {
    const { id } = useParams();
    return <Index initialTab="files" initialFileId={id} />;
};

export const TranscriptRoute = () => {
    const { id } = useParams();
    // Transcripts are also in FilesPage
    return <Index initialTab="files" initialFileId={id} />;
};
