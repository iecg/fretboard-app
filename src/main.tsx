import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/index.css'
import './styles/semantic.css'
import './styles/themes.css'
// Fretboard design tokens — owned by @fretflow/fretboard, re-imported here so
// the web app's rendering (and HelpModal --fb-* usage) is unchanged. Single
// source of truth; defined once, so import order is not significant.
import '@fretflow/fretboard/styles/fretboard-tokens.css'
import './styles/controls.css'
import App from './App.tsx'
import { ErrorBoundary, ErrorFallback } from './components/ErrorBoundary/ErrorBoundary'
import { runChordModeMigration } from './store/chordModeMigration'
import { runV2RedesignMigration } from './store/v2RedesignMigration'

runChordModeMigration();
runV2RedesignMigration();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)