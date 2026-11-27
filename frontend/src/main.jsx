import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { applyTheme } from './utils/theme'

// Apply the saved theme before the first paint so the page doesn't flash.
applyTheme(undefined, window.location.pathname === '/self-checkout')

createRoot(document.getElementById('root')).render(
    <App />
)
