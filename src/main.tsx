import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'
import { AppProvider } from './state/AppContext'

// Invite links look like #/join/<code>. Keep the code until the person has signed in.
const join = window.location.hash.match(/^#\/join\/([a-z0-9]+)/i)
if (join) { localStorage.setItem('join-code', join[1].toLowerCase()); window.location.hash = '#/' }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)
