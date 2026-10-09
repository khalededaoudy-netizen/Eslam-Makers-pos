import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './services/i18n/i18n'

// Prevent mouse wheel from changing values in number inputs across the app
document.addEventListener(
  'wheel',
  () => {
    if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'number') {
      document.activeElement.blur()
    }
  },
  { passive: true }
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

