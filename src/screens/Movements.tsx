import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db.ts'
import { categoryById } from '../categories.ts'
import { normalize } from '../parse.ts'
import { dayLabel, fmt } from '../lib.ts'
import { useApp } from '../App.tsx'
import { MonthSwitch } from './Dashboard.tsx'

export default function Movements() {
  const { month, category, setCategory, edit, go } = useApp()
  const [q, setQ] = useState('')
  const [type, setType] = useState<'todos' | 'gasto' | 'ingreso'>('todos')
  const txs = useLiveQuery(() => db.txs.where('date').between(month + '-01', month + '-31', true, true).reverse().sortBy('date'), [month]) ?? []

  const presentCats = useMemo(() => [...new Set(txs.map((t) => t.category))], [txs])
  const list = txs.filter((t) =>
    (type === 'todos' || t.type === type) &&
    (!category || t.category === category) &&
    (!q || normalize(t.description).includes(normalize(q))))
  const days = useMemo(() => {
    const m = new Map<string, typeof list>()
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t])
    return [...m]
  }, [list])
  const total = list.reduce((s, t) => s + (t.type === 'ingreso' ? t.amount : -t.amount), 0)

  return (
    <>
      <header className="topbar">
        <div><p className="eyebrow">Movimientos</p><h1>{list.length} {list.length === 1 ? 'movimiento' : 'movimientos'}</h1></div>
        <MonthSwitch />
      </header>

      <div className="grid" style={{ gap: 10 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input className="input" type="search" placeholder="Buscar por descripción" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 220px' }} aria-label="Buscar" />
          <div className="segmented" role="group" aria-label="Tipo" style={{ flex: 'none' }}>
            {(['todos', 'gasto', 'ingreso'] as const).map((t) => (
              <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>{t === 'todos' ? 'Todos' : t === 'gasto' ? 'Gastos' : 'Ingresos'}</button>
            ))}
          </div>
        </div>
        {presentCats.length > 1 && (
          <div className="chips" role="group" aria-label="Categoría">
            <button className="chip" aria-pressed={!category} onClick={() => setCategory(null)}>Todas</button>
            {presentCats.map((id) => (
              <button key={id} className="chip" aria-pressed={category === id} onClick={() => setCategory(category === id ? null : id)}>{categoryById(id).label}</button>
            ))}
          </div>
        )}
        {list.length > 0 && (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Balance de lo filtrado: <strong className={`num ${total < 0 ? 'expense' : 'income'}`}>{fmt(total)}</strong>
          </p>
        )}
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <strong>Nada por aquí</strong>
          <p>{txs.length ? 'Ningún movimiento coincide con el filtro.' : 'No hay movimientos este mes.'}</p>
          {!txs.length && <button className="btn primary" onClick={() => go('importar')}>Subir estado de cuenta</button>}
        </div>
      ) : days.map(([date, items]) => (
        <section key={date} className="day">
          <div className="day-head"><span>{dayLabel(date)}</span></div>
          {items.map((t) => (
            <button key={t.id} className="tx" onClick={() => edit(t)}>
              <span className="desc">{t.description}</span>
              <span className={`amt ${t.type === 'ingreso' ? 'income' : ''}`}>{t.type === 'ingreso' ? '+' : '−'}{fmt(t.amount)}</span>
              <span className="cat">{categoryById(t.category).label}{t.source === 'import' ? ' · importado' : ''}</span>
            </button>
          ))}
        </section>
      ))}
    </>
  )
}
