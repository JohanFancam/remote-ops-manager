import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { applyTheme, readCachedTheme } from '@/utils/theme'
import { registerServiceWorker } from '@/lib/pushNotifications'

applyTheme(readCachedTheme())
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
