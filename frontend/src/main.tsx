import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { RealtimeProvider } from './providers/RealtimeProvider';
import { resetRealtime } from './services/realtimeInit';
import { socketService } from './services/socketService';

console.log('[main.tsx] 🎬 Module executing')

// Remove the CSS import as we'll use MUI's styling

// Clean up on full page unload
window.addEventListener('beforeunload', () => {
  console.log('[main.tsx] 🚪 Page unloading')
  resetRealtime();
  socketService.disconnect();
});

console.log('[main.tsx] 🎨 Creating root and rendering')

createRoot(document.getElementById('root')!).render(
  <RealtimeProvider userId="user1">
    <App />
  </RealtimeProvider>
);

console.log('[main.tsx] ✅ Render call complete')
