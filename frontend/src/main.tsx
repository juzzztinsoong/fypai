import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { RealtimeProvider } from './providers/RealtimeProvider';

// Remove the CSS import as we'll use MUI's styling

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RealtimeProvider userId="user1">
      <App />
    </RealtimeProvider>
  </StrictMode>
);
