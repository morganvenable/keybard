import HostOverlay from "./features/trainer/HostOverlay";
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import 'virtual:paranoid-fonts';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).has("hostOverlay") ? <HostOverlay /> : <App />}
  </React.StrictMode>
);
