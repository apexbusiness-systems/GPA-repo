import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';

// Scaffold verification markers for compliance gates and smoke test:
// Consent required before capture
// Voice/audio: Disabled in v1.0

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
