import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportBackup, importBackup } from '../db.ts'
import { useApp } from '../App.tsx'
import { loadSample } from '../sample.ts'
import type { ThemePref } from '../lib.ts'

export default function Settings() {
  const { theme, toast } = useApp()
  const counts = useLiveQuery(async () => ({ txs: await db.txs.count(), goals: await db.goals.count(), rules: await db.rules.count() }), [])

  async function restore(file?: File) {
    if (!file || !confirm('Esto reemplaza todos tus datos actuales con los del respaldo. ¿Continuar?')) return
    try { await importBackup(file); toast('Respaldo restaurado') } catch (e) { toast((e as Error).message) }
  }
  async function wipe() {
    if (!confirm('¿Borrar todos los movimientos, metas y reglas? No se puede deshacer.')) return
    await Promise.all([db.txs.clear(), db.goals.clear(), db.rules.clear()])
    toast('Datos borrados')
  }

  return (
    <>
      <header className="topbar"><div><p className="eyebrow">Ajustes</p><h1>Ajustes</h1></div></header>
      <div className="grid grid-2-even">
        <section className="card">
          <h2 style={{ marginBottom: 12 }}>Apariencia</h2>
          <div className="segmented" role="group" aria-label="Tema">
            {([['system', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']] as [ThemePref, string][]).map(([v, l]) => (
              <button key={v} aria-pressed={theme.pref === v} onClick={() => theme.setPref(v)}>{l}</button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Automático sigue la configuración de tu teléfono.</p>
        </section>

        <section className="card">
          <h2 style={{ marginBottom: 4 }}>Tus datos</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Se guardan solo en este dispositivo: {counts?.txs ?? 0} movimientos, {counts?.goals ?? 0} metas y {counts?.rules ?? 0} comercios aprendidos. Descarga un respaldo de vez en cuando.
          </p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={exportBackup}>Descargar respaldo</button>
            <label className="btn">Restaurar respaldo<input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { restore(e.target.files?.[0]); e.target.value = '' }} /></label>
          </div>
        </section>

        <section className="card">
          <h2 style={{ marginBottom: 4 }}>Datos de ejemplo</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Carga 6 meses de movimientos ficticios para explorar la app.</p>
          <button className="btn" onClick={async () => { await loadSample(); toast('Datos de ejemplo cargados') }}>Cargar ejemplo</button>
        </section>

        <section className="card">
          <h2 style={{ marginBottom: 4 }}>Zona de peligro</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>Borra todo lo guardado en este dispositivo.</p>
          <button className="btn danger" onClick={wipe}>Borrar todos los datos</button>
        </section>
      </div>
    </>
  )
}
