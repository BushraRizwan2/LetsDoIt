
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Shim process for browser environments where it's missing (e.g. Vercel static)
// Ensure we don't overwrite if it already exists partially
if (typeof (window as any).process === 'undefined') {
  (window as any).process = { env: {} };
} else if (!(window as any).process.env) {
  (window as any).process.env = {};
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
