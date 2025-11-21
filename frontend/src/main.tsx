import { createRoot } from 'react-dom/client';
import * as Sentry from "@sentry/react";
import './index.css';
import App from './App';
import { RealtimeProvider } from './providers/RealtimeProvider';
import { resetRealtime } from './services/realtimeInit';
import { socketService } from './services/socketService';

console.log('[main.tsx] 🎬 Module executing')

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
  });
  console.log('✅ Sentry initialized (Frontend)');
}

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
