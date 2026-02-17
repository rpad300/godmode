/**
 * Purpose:
 *   Application bootstrap entry point. Mounts the React root into the DOM.
 *
 * Responsibilities:
 *   - Locate the #root element and bail with a clear error when missing
 *   - Render the top-level <App /> inside React StrictMode
 *   - Import the global stylesheet (index.css)
 *
 * Key dependencies:
 *   - react-dom/client: createRoot API for concurrent rendering
 *   - App: top-level component that wires routing, auth, and providers
 *
 * Side effects:
 *   - Mounts the React tree into the DOM
 *
 * Notes:
 *   - StrictMode is enabled to surface potential issues during development
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
