import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {import.meta.env.VITE_PREVIEW === 'true' && (
      <div role="status" style={{ position: 'fixed', bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 99999, background: '#713f12', color: '#fff', padding: '4px 12px', borderRadius: 6, pointerEvents: 'none', fontSize: 12 }}>
        Sval preview
      </div>
    )}
    <App />
  </React.StrictMode>
);