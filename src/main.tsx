import HostOverlay from "./features/trainer/HostOverlay";
import HostPointingDemo from "./features/trainer/HostPointingDemo";
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import 'virtual:paranoid-fonts';
import { startFakeBoard } from './dev/fake-board/start';

// ?fakeBoard only: a simulated Svalboard in place of WebHID (nothing happens without it)
startFakeBoard();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).has("hostOverlay")
      ? (new URLSearchParams(window.location.search).get("hostDemo") === "pointing" ? <HostPointingDemo /> : <HostOverlay />)
      : <App />}
  </React.StrictMode>
);
