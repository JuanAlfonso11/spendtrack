import { createContext, useContext, useEffect, useState } from 'react'
import { Icon, type IconName } from './icons.tsx'
import { CHART, monthOf, today, useTheme, type ChartColors } from './lib.ts'
import type { Tx } from './db.ts'
import TxDialog from './TxDialog.tsx'
import Dashboard from './screens/Dashboard.tsx'
import Movements from './screens/Movements.tsx'
import Cards from './screens/Cards.tsx'
import Import from './screens/Import.tsx'
import Savings from './screens/Savings.tsx'
import Settings from './screens/Settings.tsx'

export type Route = 'resumen' | 'movimientos' | 'tarjetas' | 'ahorro' | 'importar' | 'ajustes'
const NAV: { id: Route; label: string; icon: IconName; desktopOnly?: boolean }[] = [
  { id: 'resumen', label: 'Resumen', icon: 'home' },
  { id: 'movimientos', label: 'Movimientos', icon: 'list' },
  { id: 'tarjetas', label: 'Tarjetas', icon: 'card' },
  { id: 'ahorro', label: 'Ahorro', icon: 'target' },
  { id: 'importar', label: 'Importar', icon: 'upload' },
  { id: 'ajustes', label: 'Ajustes', icon: 'settings', desktopOnly: true },
]

type Ctx = {
  month: string
  setMonth: (m: string) => void
  // `sub` es la subsección: la categoría en movimientos, la tarjeta en importar, la pestaña en ahorro.
  go: (r: Route, sub?: string | number) => void
  sub: string | null
  setSub: (s: string | null) => void
  edit: (tx?: Partial<Tx>) => void
  toast: (msg: string) => void
  colors: ChartColors
  theme: ReturnType<typeof useTheme>
}
const AppCtx = createContext<Ctx>(null!)
export const useApp = () => useContext(AppCtx)

const parseHash = (): [Route, string | null] => {
  const [r, sub] = location.hash.replace('#/', '').split('/') as [Route, string?]
  return NAV.some((n) => n.id === r) ? [r, sub ? decodeURIComponent(sub) : null] : ['resumen', null]
}

export default function App() {
  const theme = useTheme()
  const [[route, sub], setLoc] = useState(parseHash)
  const [month, setMonth] = useState(monthOf(today()))
  const [editing, setEditing] = useState<Partial<Tx> | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const on = () => setLoc(parseHash())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])

  const go = (r: Route, s?: string | number) => { location.hash = `/${r}${s != null ? '/' + encodeURIComponent(s) : ''}`; scrollTo(0, 0) }
  const ctx: Ctx = {
    month, setMonth, sub, theme, go,
    setSub: (s) => go(route, s ?? undefined),
    colors: CHART[theme.resolved],
    edit: (tx) => setEditing(tx ?? {}),
    toast: setMsg,
  }
  const Screen = { resumen: Dashboard, movimientos: Movements, tarjetas: Cards, ahorro: Savings, importar: Import, ajustes: Settings }[route]

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <nav className="nav" aria-label="Principal">
          <div className="brand"><img src="/icon.svg" alt="" />SpendTrack</div>
          {NAV.map((n) => (
            <a key={n.id} href={`#/${n.id}`} className={n.desktopOnly ? 'desktop-only' : undefined} aria-current={route === n.id ? 'page' : undefined}>
              <Icon name={n.icon} />{n.label}
            </a>
          ))}
        </nav>
        <main className="main"><Screen key={route} /></main>
        {(route === 'resumen' || route === 'movimientos') && (
          <button className="fab" aria-label="Agregar movimiento" onClick={() => setEditing({})}><Icon name="plus" /></button>
        )}
        {editing && <TxDialog initial={editing} onClose={() => setEditing(null)} />}
        {msg && <div className="toast" role="status">{msg}</div>}
      </div>
    </AppCtx.Provider>
  )
}

export function ThemeButton() {
  const { theme } = useApp()
  const dark = theme.resolved === 'dark'
  return (
    <button className="btn icon-btn" onClick={() => theme.setPref(dark ? 'light' : 'dark')} aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  )
}

// En el celular, Ajustes se abre desde este botón (la barra inferior tiene 5 secciones).
export function SettingsButton() {
  return <a className="btn icon-btn mobile-only" href="#/ajustes" aria-label="Ajustes"><Icon name="settings" /></a>
}
