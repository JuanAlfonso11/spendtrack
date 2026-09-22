import { createContext, useContext, useEffect, useState } from 'react'
import { Icon, type IconName } from './icons.tsx'
import { CHART, monthOf, today, useTheme, type ChartColors } from './lib.ts'
import type { Tx } from './db.ts'
import TxDialog from './TxDialog.tsx'
import Dashboard from './screens/Dashboard.tsx'
import Movements from './screens/Movements.tsx'
import Import from './screens/Import.tsx'
import Goals from './screens/Goals.tsx'
import Settings from './screens/Settings.tsx'

type Route = 'resumen' | 'movimientos' | 'importar' | 'metas' | 'ajustes'
const NAV: { id: Route; label: string; icon: IconName }[] = [
  { id: 'resumen', label: 'Resumen', icon: 'home' },
  { id: 'movimientos', label: 'Movimientos', icon: 'list' },
  { id: 'importar', label: 'Importar', icon: 'upload' },
  { id: 'metas', label: 'Metas', icon: 'target' },
  { id: 'ajustes', label: 'Ajustes', icon: 'settings' },
]

type Ctx = {
  month: string
  setMonth: (m: string) => void
  go: (r: Route, category?: string) => void
  category: string | null
  setCategory: (c: string | null) => void
  edit: (tx?: Partial<Tx>) => void
  toast: (msg: string) => void
  colors: ChartColors
  theme: ReturnType<typeof useTheme>
}
const AppCtx = createContext<Ctx>(null!)
export const useApp = () => useContext(AppCtx)

const routeFromHash = (): Route => {
  const r = location.hash.replace('#/', '') as Route
  return NAV.some((n) => n.id === r) ? r : 'resumen'
}

export default function App() {
  const theme = useTheme()
  const [route, setRoute] = useState<Route>(routeFromHash)
  const [month, setMonth] = useState(monthOf(today()))
  const [category, setCategory] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<Tx> | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const on = () => setRoute(routeFromHash())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])

  const ctx: Ctx = {
    month, setMonth, category, setCategory, theme,
    colors: CHART[theme.resolved],
    go: (r, c) => { setCategory(c ?? null); location.hash = `/${r}`; scrollTo(0, 0) },
    edit: (tx) => setEditing(tx ?? {}),
    toast: setMsg,
  }
  const Screen = { resumen: Dashboard, movimientos: Movements, importar: Import, metas: Goals, ajustes: Settings }[route]

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <nav className="nav" aria-label="Principal">
          <div className="brand"><img src="/icon.svg" alt="" />SpendTrack</div>
          {NAV.map((n) => (
            <a key={n.id} href={`#/${n.id}`} aria-current={route === n.id ? 'page' : undefined} onClick={() => setCategory(null)}>
              <Icon name={n.icon} />{n.label}
            </a>
          ))}
        </nav>
        <main className="main"><Screen /></main>
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
