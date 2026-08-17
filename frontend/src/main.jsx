import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const originalFetch = window.fetch;
window.fetch = async (url, options = {}) => {
  if (url.toString().includes('localhost:8000') || url.toString().includes('/api')) {
    options.credentials = 'include';
  }
  return originalFetch(url, options);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
