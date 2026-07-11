import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from './app/AuthProvider'
import { router } from './app/router'
import { initTheme } from './lib/theme'
import './i18n'
import './index.css'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
