import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db, type Card, type Tx } from '../db.ts'
import { categoryById, isTransfer } from '../categories.ts'
import { cardStatus } from '../finance.ts'
import { fmt, fmtShort, monthLabel, monthOf, shiftMonth, today } from '../lib.ts'
import { useApp } from '../App.tsx'
import { Icon } from '../icons.tsx'

const shortDate = (d: string) => new Date(d + 'T12:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short' }).replace('.', '')

export default function Cards() {
  const { go, edit, sub } = useApp()
  const cards = useLiveQuery(() => db.cards.toArray(), [])
  const txs = useLiveQuery(() => db.txs.where('account').above(0).toArray(), [])
  const [editing, setEditing] = useState<Partial<Card> | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(sub ? +sub : null)

  if (!cards || !txs) return null
  const now = today()
  const statuses = cards.map((c) => ({ card: c, s: cardStatus(c, txs, now) }))
  const totalDebt = statuses.reduce((a, x) => a + Math.max(0, x.s.balance), 0)
  const totalToPay = statuses.reduce((a, x) => a + x.s.toPay, 0)
  const nextDue = statuses.filter((x) => x.s.toPay > 0).sort((a, b) => a.s.due.localeCompare(b.s.due))[0]
  const selected = statuses.find((x) => x.card.id === selectedId) ?? statuses[0]

  return (
    <>
      <header className="topbar">
        <div><p className="eyebrow">Tarjetas</p><h1>Tarjetas de crédito</h1></div>
        <button className="btn primary" onClick={() => setEditing({})}><Icon name="plus" />Agregar tarjeta</button>
      </header>

      {cards.length === 0 ? (
        <div className="card empty">
          <strong>Agrega tu tarjeta de crédito</strong>
          <p>Con el día de corte y la fecha límite te decimos cuánto pagar para no generar intereses, cuánto crédito te queda y en qué la estás usando.</p>
          <button className="btn primary" onClick={() => setEditing({})}>Agregar tarjeta</button>
        </div>
      ) : (
        <div className="grid">
          <section className="kpis" aria-label="Resumen de tarjetas">
            <div className="kpi"><div className="label">Deuda total</div><div className="value">{fmt(totalDebt)}</div><div className="delta">{cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}</div></div>
            <div className="kpi"><div className="label">Para no pagar intereses</div><div className="value">{fmt(totalToPay)}</div><div className="delta">Suma de los saldos al corte</div></div>
            <div className="kpi"><div className="label">Próximo pago</div><div className="value">{nextDue ? shortDate(nextDue.s.due) : '—'}</div><div className="delta">{nextDue ? `${nextDue.card.name} · ${fmt(nextDue.s.toPay)}` : 'Nada pendiente'}</div></div>
            <div className="kpi"><div className="label">Uso del crédito</div><div className="value">{Math.round((totalDebt / Math.max(1, cards.reduce((a, c) => a + c.limit, 0))) * 100)}%</div><div className="delta">Lo sano: menos de 30%</div></div>
          </section>

          {cards.length > 1 && (
            <div className="chips" role="group" aria-label="Tarjeta">
              {cards.map((c) => (
                <button key={c.id} className="chip" aria-pressed={selected.card.id === c.id} onClick={() => setSelectedId(c.id!)}>{c.name} ••{c.last4}</button>
              ))}
            </div>
          )}

          <CardDetail key={selected.card.id} card={selected.card} s={selected.s} txs={txs.filter((t) => t.account === selected.card.id)}
            onEdit={() => setEditing(selected.card)}
            onPay={() => edit({ type: 'ingreso', category: 'pago_recibido', description: 'Pago a tarjeta', account: selected.card.id, amount: selected.s.toPay || undefined })}
            onImport={() => go('importar', selected.card.id)} />
        </div>
      )}
      {editing && <CardDialog initial={editing} txs={txs} onClose={() => setEditing(null)} />}
    </>
  )
}

function CardDetail({ card, s, txs, onEdit, onPay, onImport }: {
  card: Card; s: ReturnType<typeof cardStatus>; txs: Tx[]; onEdit: () => void; onPay: () => void; onImport: () => void
}) {
  const { colors: c, edit } = useApp()
  const pct = Math.max(0, Math.min(1, s.utilization))
  const level = s.utilization >= 0.7 ? { label: 'Uso alto', cls: 'danger' } : s.utilization >= 0.3 ? { label: 'Uso moderado', cls: 'warn' } : { label: 'Uso sano', cls: '' }

  const d = useMemo(() => {
    const cur = monthOf(today())
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const m = shiftMonth(cur, i - 5)
      return { month: m, label: monthLabel(m, 'short'), consumos: txs.filter((t) => monthOf(t.date) === m && t.type === 'gasto' && !isTransfer(t.category)).reduce((a, t) => a + t.amount, 0) }
    })
    const byCat = new Map<string, number>()
    for (const t of txs) if (t.date > s.lastCut && t.type === 'gasto' && !isTransfer(t.category)) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount)
    const cats = [...byCat].map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total)
    const recent = [...txs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
    return { monthly, cats, recent }
  }, [txs, s.lastCut])

  const dueText = s.toPay === 0 ? 'Estás al día' : s.overdue ? `Venció el ${shortDate(s.due)}` : s.daysToDue === 0 ? 'Vence hoy' : `Vence el ${shortDate(s.due)} · ${s.daysToDue === 1 ? 'falta 1 día' : `faltan ${s.daysToDue} días`}`

  return (
    <>
      <div className="grid grid-2">
        <section className="credit-card">
          <div className="spread">
            <span className="cc-name">{card.name}</span>
            <span className="num" style={{ letterSpacing: "0.12em" }}>•••• {card.last4}</span>
          </div>
          <div>
            <div className="cc-label">Saldo actual</div>
            <div className="cc-balance num">{fmt(s.balance)}</div>
          </div>
          <div>
            <div className="util" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Uso del límite">
              <div className={level.cls} style={{ width: `${pct * 100}%` }} />
              <span className="util-mark" title="30% del límite" />
            </div>
            <div className="spread cc-foot">
              <span>{Math.round(s.utilization * 100)}% usado · {level.label}</span>
              <span className="num">Disponible {fmt(s.available)}</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><div><h2>Para no pagar intereses</h2><p>Saldo al corte del {shortDate(s.lastCut)} menos lo que ya pagaste.</p></div></div>
          <div className="big-number num">{fmt(s.toPay)}</div>
          <p className={s.overdue ? 'expense' : 'muted'} style={{ margin: '4px 0 14px', fontWeight: s.overdue ? 600 : 400 }}>{dueText}</p>
          <div className="goal-meta" style={{ marginBottom: 14 }}>
            <span>Consumos desde el corte: <strong className="num">{fmt(s.cycleSpend)}</strong></span>
            <span>Próximo corte: {shortDate(s.nextCut)}</span>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={onPay}>Registrar pago</button>
            <button className="btn" onClick={onImport}>Importar estado</button>
            <button className="btn ghost" onClick={onEdit}>Editar</button>
          </div>
        </section>
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head"><div><h2>Consumos por mes</h2><p>Lo que cargaste a esta tarjeta en los últimos 6 meses.</p></div></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.monthly} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="32%">
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="label" interval={0} tickLine={false} axisLine={{ stroke: c.grid }} tick={{ fill: c.muted, fontSize: 11 }} tickFormatter={(l: string) => l.split(' ')[0]} />
              <YAxis tickFormatter={fmtShort} tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 12 }} width={64} />
              <Tooltip cursor={{ fill: c.grid, opacity: 0.5 }} content={({ active, payload }) => active && payload?.length ? (
                <div className="tooltip"><div className="t-title">{monthLabel(payload[0].payload.month)}</div><div className="t-row"><span>Consumos</span><span className="num">{fmt(payload[0].payload.consumos)}</span></div></div>
              ) : null} />
              <Bar dataKey="consumos" fill={c.expense} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="card">
          <div className="card-head"><div><h2>En qué la usas</h2><p>Consumos desde el último corte.</p></div></div>
          {d.cats.length === 0 ? <p className="muted">Sin consumos en este ciclo.</p> : (
            <ul className="catbars">
              {d.cats.slice(0, 6).map((cat) => (
                <li key={cat.id} className="catbar" style={{ cursor: 'default' }}>
                  <span className="name">{categoryById(cat.id).label}</span>
                  <span className="amt">{fmt(cat.total)}</span>
                  <span className="track"><span className="fill" style={{ width: `${(cat.total / d.cats[0].total) * 100}%`, display: 'block' }} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head"><div><h2>Últimos movimientos</h2></div></div>
        {d.recent.length === 0 ? <p className="muted">Aún no hay movimientos en esta tarjeta. Importa su estado de cuenta o agrega un consumo.</p> : d.recent.map((t) => (
          <button key={t.id} className="tx" onClick={() => edit(t)}>
            <span className="desc">{t.description}</span>
            <span className={`amt ${t.type === 'ingreso' ? 'income' : ''}`}>{t.type === 'ingreso' ? '+' : '−'}{fmt(t.amount)}</span>
            <span className="cat">{shortDate(t.date)} · {categoryById(t.category).label}</span>
          </button>
        ))}
      </section>
    </>
  )
}

function CardDialog({ initial, txs, onClose }: { initial: Partial<Card>; txs: Tx[]; onClose: () => void }) {
  const { toast } = useApp()
  const ref = useRef<HTMLDialogElement>(null)
  const current = initial.id ? cardStatus(initial as Card, txs, today()).balance : 0
  const [f, setF] = useState({
    name: initial.name ?? '', last4: initial.last4 ?? '', limit: initial.limit ? String(initial.limit) : '',
    closingDay: String(initial.closingDay ?? ''), dueDay: String(initial.dueDay ?? ''), balance: initial.id ? String(Math.round(current * 100) / 100) : '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  useEffect(() => { ref.current?.showModal() }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const num = (v: string) => parseFloat(v.replace(/,/g, '')) || 0
    const day = (v: string) => Math.min(31, Math.max(1, Math.round(num(v))))
    const withoutAdjust = current - (initial.adjust ?? 0)
    const card: Card = {
      name: f.name.trim(), last4: f.last4.replace(/\D/g, '').slice(-4), limit: num(f.limit),
      closingDay: day(f.closingDay), dueDay: day(f.dueDay),
      // ponytail: el saldo escrito se guarda como ajuste; si luego importas meses viejos, vuelve a escribir el saldo.
      adjust: num(f.balance) - withoutAdjust,
      adjustDate: num(f.balance) - withoutAdjust !== initial.adjust ? today() : initial.adjustDate,
    }
    if (!card.name || !(card.limit > 0)) return toast('Escribe el nombre y el límite')
    if (initial.id) await db.cards.update(initial.id, card)
    else await db.cards.add(card)
    toast(initial.id ? 'Tarjeta actualizada' : 'Tarjeta agregada')
    onClose()
  }
  async function remove() {
    if (!initial.id || !confirm('¿Eliminar esta tarjeta? Sus movimientos pasarán a la cuenta bancaria.')) return
    await db.transaction('rw', db.cards, db.txs, async () => {
      await db.txs.where('account').equals(initial.id!).modify((t) => { delete t.account })
      await db.cards.delete(initial.id!)
    })
    onClose()
  }

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <form onSubmit={save}>
        <div className="spread">
          <h2>{initial.id ? 'Editar tarjeta' : 'Nueva tarjeta'}</h2>
          <button type="button" className="btn ghost icon-btn" aria-label="Cerrar" onClick={() => ref.current?.close()}><Icon name="x" /></button>
        </div>
        <div className="row">
          <label className="field" style={{ flex: 2 }}>Nombre<input className="input" required placeholder="Visa Popular" value={f.name} onChange={set('name')} /></label>
          <label className="field">Últimos 4<input className="input num" inputMode="numeric" maxLength={4} placeholder="1234" value={f.last4} onChange={set('last4')} /></label>
        </div>
        <label className="field">Límite de crédito (RD$)<input className="input num" required inputMode="decimal" placeholder="100,000" value={f.limit} onChange={set('limit')} /></label>
        <div className="row">
          <label className="field">Día de corte<input className="input num" required inputMode="numeric" placeholder="15" value={f.closingDay} onChange={set('closingDay')} /></label>
          <label className="field">Fecha límite de pago<input className="input num" required inputMode="numeric" placeholder="8" value={f.dueDay} onChange={set('dueDay')} /></label>
        </div>
        <label className="field">Lo que debes hoy (RD$)
          <input className="input num" inputMode="decimal" placeholder="0" value={f.balance} onChange={set('balance')} />
          <span className="muted" style={{ fontSize: 12 }}>Lo ves en la App Popular. Si importas el estado de la tarjeta, puedes dejarlo en 0.</span>
        </label>
        <div className="row">
          {initial.id && <button type="button" className="btn danger" onClick={remove}>Eliminar</button>}
          <button className="btn primary">Guardar</button>
        </div>
      </form>
    </dialog>
  )
}
