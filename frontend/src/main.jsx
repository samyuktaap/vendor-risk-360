import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Kaspersky patches window.fetch and breaks localhost requests.
// Keep a hidden iframe alive so its fetch (which AV can't touch) stays valid.
const _iframe = document.createElement('iframe');
_iframe.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute;top:-9999px';
document.documentElement.appendChild(_iframe);
const nativeFetch = _iframe.contentWindow.fetch.bind(_iframe.contentWindow);

window.fetch = (url, options = {}) => {
  if (typeof url === 'string' && (url.includes('localhost:8000') || url.includes('/api'))) {
    options = { ...options, credentials: 'include' };
  }
  return nativeFetch(url, options);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
