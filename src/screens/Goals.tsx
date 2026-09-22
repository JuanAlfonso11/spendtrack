import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Goal } from '../db.ts'
import { fmt, monthOf, shiftMonth, today } from '../lib.ts'
import { useApp } from '../App.tsx'
import { isTransfer } from '../categories.ts'
import { Icon } from '../icons.tsx'

const weeksUntil = (date: string) => Math.max(0, (new Date(date + 'T12:00').getTime() - Date.now()) / (7 * 86400000))

export default function Goals() {
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const [editing, setEditing] = useState<Partial<Goal> | null>(null)
  // Ahorro promedio de los últimos 3 meses completos, para estimar cuándo se llega.
  const avgSaving = useLiveQuery(async () => {
    const end = shiftMonth(monthOf(today()), -1)
    const txs = await db.txs.where('date').between(shiftMonth(end, -2) + '-01', end + '-31', true, true).toArray()
    return txs.filter((t) => !isTransfer(t.category)).reduce((s, t) => s + (t.type === 'ingreso' ? t.amount : -t.amount), 0) / 3
  }, []) ?? 0

  if (!goals) return null
  return (
    <>
      {goals.length > 0 && (
        <div className="spread" style={{ marginBottom: 14 }}>
          <p className="muted" style={{ margin: 0 }}>Llevas <strong className="num">{fmt(goals.reduce((s, g) => s + g.saved, 0))}</strong> ahorrado en {goals.length} {goals.length === 1 ? 'meta' : 'metas'}.</p>
          <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" />Nueva meta</button>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="card empty">
          <strong>Ponte una meta</strong>
          <p>Un fondo de emergencia, un viaje, el inicial de un carro. Te decimos cuánto apartar cada semana para llegar a tiempo.</p>
          <button className="btn primary" onClick={() => setEditing({})}>Crear mi primera meta</button>
        </div>
      ) : (
        <div className="grid grid-2-even">
          {goals.map((g) => <GoalCard key={g.id} goal={g} avgSaving={avgSaving} onEdit={() => setEditing(g)} />)}
        </div>
      )}
      {editing && <GoalDialog initial={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function GoalCard({ goal: g, avgSaving, onEdit }: { goal: Goal; avgSaving: number; onEdit: () => void }) {
  const { toast } = useApp()
  const [amount, setAmount] = useState('')
  const pct = Math.min(100, (g.saved / g.target) * 100)
  const left = Math.max(0, g.target - g.saved)
  const weeks = g.deadline ? weeksUntil(g.deadline) : null
  const perWeek = weeks && weeks >= 1 ? left / weeks : null
  const monthsAtPace = avgSaving > 0 ? Math.ceil(left / avgSaving) : null

  async function add(sign: 1 | -1) {
    const v = parseFloat(amount.replace(/,/g, ''))
    if (!(v > 0)) return
    await db.goals.update(g.id!, { saved: Math.max(0, g.saved + sign * v) })
    setAmount('')
    toast(sign > 0 ? `Aporte de ${fmt(v)} a ${g.name}` : `Retiro de ${fmt(v)} de ${g.name}`)
  }

  return (
    <section className="card goal">
      <div className="goal-head">
        <h3>{g.name}</h3>
        <button className="btn ghost" onClick={onEdit}>Editar</button>
      </div>
      <div className="spread">
        <span className="num" style={{ font: '400 28px var(--serif)' }}>{fmt(g.saved)}</span>
        <span className="muted num">de {fmt(g.target)}</span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso de ${g.name}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="goal-meta">
        <span>{Math.round(pct)}% completado</span>
        {left === 0 ? <span className="income">Meta cumplida</span> : <span>Faltan {fmt(left)}</span>}
        {left > 0 && perWeek && <span>Aparta <strong className="num">{fmt(perWeek)}</strong> por semana para llegar el {new Date(g.deadline! + 'T12:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
        {left > 0 && g.deadline && !perWeek && <span className="expense">La fecha ya pasó</span>}
        {left > 0 && !g.deadline && monthsAtPace && <span>A tu ritmo de ahorro actual llegas en unos {monthsAtPace} {monthsAtPace === 1 ? 'mes' : 'meses'}</span>}
      </div>
      {left > 0 && (
        <div className="row">
          <input className="input" inputMode="decimal" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} aria-label={`Monto para ${g.name}`} />
          <button className="btn" style={{ flex: 'none' }} onClick={() => add(-1)} disabled={!amount}>Retirar</button>
          <button className="btn primary" style={{ flex: 'none' }} onClick={() => add(1)} disabled={!amount}>Aportar</button>
        </div>
      )}
    </section>
  )
}

function GoalDialog({ initial, onClose }: { initial: Partial<Goal>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(initial.name ?? '')
  const [target, setTarget] = useState(initial.target ? String(initial.target) : '')
  const [saved, setSaved] = useState(initial.saved ? String(initial.saved) : '')
  const [deadline, setDeadline] = useState(initial.deadline ?? '')
  useEffect(() => { ref.current?.showModal() }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const goal = { name: name.trim(), target: parseFloat(target.replace(/,/g, '')), saved: parseFloat(saved.replace(/,/g, '')) || 0, deadline: deadline || undefined }
    if (!goal.name || !(goal.target > 0)) return
    if (initial.id) await db.goals.update(initial.id, goal)
    else await db.goals.add({ ...goal, createdAt: today() })
    onClose()
  }
  async function remove() {
    if (initial.id && confirm('¿Eliminar esta meta?')) { await db.goals.delete(initial.id); onClose() }
  }

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <form onSubmit={save}>
        <div className="spread">
          <h2>{initial.id ? 'Editar meta' : 'Nueva meta'}</h2>
          <button type="button" className="btn ghost icon-btn" aria-label="Cerrar" onClick={() => ref.current?.close()}><Icon name="x" /></button>
        </div>
        <label className="field">Nombre<input className="input" required placeholder="Fondo de emergencia" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="row">
          <label className="field">Meta (RD$)<input className="input num" required inputMode="decimal" placeholder="100,000" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
          <label className="field">Ya tengo (RD$)<input className="input num" inputMode="decimal" placeholder="0" value={saved} onChange={(e) => setSaved(e.target.value)} /></label>
        </div>
        <label className="field">Fecha límite (opcional)<input className="input" type="date" min={today()} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
        <div className="row">
          {initial.id && <button type="button" className="btn danger" onClick={remove}>Eliminar</button>}
          <button className="btn primary">Guardar</button>
        </div>
      </form>
    </dialog>
  )
}
