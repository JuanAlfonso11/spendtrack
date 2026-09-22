import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import '@fontsource/instrument-serif/400.css'
import './styles.css'
import App from './App.tsx'
import { Capacitor } from '@capacitor/core'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// En el APK los archivos ya vienen dentro de la app; el service worker solo hace falta en la web.
if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) navigator.serviceWorker.register('/sw.js')
