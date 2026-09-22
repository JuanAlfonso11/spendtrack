import { useEffect, useState } from 'react'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

const money = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 2 })
export const fmt = (n: number) => money.format(n)
// Para ejes de gráficos: RD$12k, RD$1.5M (el formato compacto de es-DO mezcla "K" y "k").
export const fmtShort = (n: number) =>
  (n < 0 ? '−' : '') + 'RD$' + (Math.abs(n) >= 1e6 ? `${+(Math.abs(n) / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `${+(Math.abs(n) / 1e3).toFixed(1)}k` : `${Math.round(Math.abs(n))}`)

export const today = () => new Date().toLocaleDateString('en-CA') // aaaa-mm-dd local
export const monthOf = (date: string) => date.slice(0, 7)
export const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
export const monthLabel = (month: string, style: 'long' | 'short' = 'long') => {
  const [y, m] = month.split('-').map(Number)
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-DO', { month: style, year: style === 'long' ? 'numeric' : '2-digit' })
  return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '')
}
export const dayLabel = (date: string) => {
  const d = new Date(date + 'T12:00')
  const s = d.toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ---------- Tema ---------- */

export type ThemePref = 'system' | 'light' | 'dark'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function read(): ThemePref {
  try { return (localStorage.getItem('theme') as ThemePref) || 'system' } catch { return 'system' }
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(read)
  const [systemDark, setSystemDark] = useState(media.matches)
  useEffect(() => {
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    media.addEventListener('change', on)
    return () => media.removeEventListener('change', on)
  }, [])
  const resolved = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref
  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    if (Capacitor.isNativePlatform()) SystemBars.setStyle({ style: resolved === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
    try { localStorage.setItem('theme', pref) } catch { /* modo privado */ }
  }, [pref, resolved])
  return { pref, setPref, resolved } as const
}

// Colores de gráficos validados (daltonismo + contraste) contra la superficie de cada modo.
export const CHART = {
  light: { income: '#2F7040', expense: '#C47A1C', ink: '#1E221D', muted: '#6E7368', grid: '#E4DFD2', prev: '#A8A596', surface: '#FBFAF6' },
  dark: { income: '#55A066', expense: '#C9802A', ink: '#E9E5DA', muted: '#9C9E92', grid: '#2E332B', prev: '#5E6258', surface: '#1D201C' },
}
export type ChartColors = (typeof CHART)['light']
