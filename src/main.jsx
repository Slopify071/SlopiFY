import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/Common/ErrorBoundary.jsx'

// Catch Vite dynamic asset preload errors (e.g. stale CSS/JS chunk hashes) and reload to fetch fresh assets
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  window.location.reload()
})

// Unregister service workers in development mode to prevent stale asset caching
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister()
    }
  })
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
