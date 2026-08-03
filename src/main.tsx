import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SearchPage from './pages/SearchPage.tsx'

const isSearch = window.location.pathname.startsWith('/search');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSearch ? <SearchPage /> : <App />}
  </StrictMode>,
)
