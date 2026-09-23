import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db, getSettings } from '../db.ts'
import { categoryById, isTransfer } from '../categories.ts'
import { avgMonthlyExpense, cardStatus, investReadiness } from '../finance.ts'
import { merchantKey } from '../parse.ts'
import { daysInMonth, fmt, fmtShort, monthLabel, monthOf, shiftMonth, today } from '../lib.ts'
import { SettingsButton, ThemeButton, useApp } from '../App.tsx'
import { Icon } from '../icons.tsx'
import { loadSample } from '../sample.ts'

export function MonthSwitch({ compact = false }: { compact?: boolean }) {
  const { month, setMonth } = useApp()
  const current = monthOf(today())
  return (
    <div className="month-switch">
      <button className="btn icon-btn ghost" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))}><Icon name="left" /></button>
      {!compact && <span>{monthLabel(month)}</span>}
      <button className="btn icon-btn ghost" aria-label="Mes siguiente" disabled={month >= current} onClick={() => setMonth(shiftMonth(month, 1))}><Icon name="right" /></button>
    </div>
  )
}

export default function Dashboard() {
  const { month, setMonth, go, colors: c, edit } = useApp()
  // La ventana de 6 meses termina en el mes actual; así tocar una barra no la desplaza.
  const current = monthOf(today())
  const anchor = month >= shiftMonth(current, -5) ? current : shiftMonth(month, 5)
  const from = shiftMonth(anchor, -6) + '-01'
  const rawTxs = useLiveQuery(() => db.txs.where('date').between(from, anchor + '-31', true, true).toArray(), [from, anchor])
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? []
  // Avisos: tarjetas por pagar y dinero listo para invertir.
  const alerts = useLiveQuery(async () => {
    const now = today()
    const cards = await db.cards.toArray()
    const cardTxs = cards.length ? await db.txs.where('account').above(0).toArray() : []
    const cardList = cards.map((c) => ({ card: c, s: cardStatus(c, cardTxs, now) }))
    const settings = await getSettings()
    const start = shiftMonth(monthOf(now), -3) + '-01'
    const recent = await db.txs.where('date').aboveOrEqual(start).toArray()
    const saved = settings.savings ?? (await db.goals.toArray()).reduce((s, g) => s + g.saved, 0)
    return { cardList, invest: investReadiness(saved, avgMonthlyExpense(recent, now), settings.emergencyMonths, settings.investThreshold) }
  }, [])

  const d = useMemo(() => {
    if (!rawTxs) return null
    // Los pagos de tarjeta no cuentan: el gasto ya se registró en cada consumo.
    const txs = rawTxs.filter((t) => !isTransfer(t.category))
    const months = Array.from({ length: 7 }, (_, i) => shiftMonth(anchor, i - 6))
    const all = months.map((m) => {
      const list = txs.filter((t) => monthOf(t.date) === m)
      const sum = (type: string) => list.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)
      return { month: m, label: monthLabel(m, 'short'), ingresos: sum('ingreso'), gastos: sum('gasto') }
    })
    const idx = all.findIndex((m) => m.month === month)
    const cur = all[idx], prev = all[idx - 1]
    const monthly = all.slice(1)
    const expenses = txs.filter((t) => monthOf(t.date) === month && t.type === 'gasto')

    const byCat = new Map<string, number>()
    for (const t of expenses) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount)
    const cats = [...byCat].map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total)

    const byMerchant = new Map<string, { name: string; total: number; count: number }>()
    for (const t of expenses) {
      const k = merchantKey(t.description) || t.description
      const m = byMerchant.get(k) ?? { name: t.description, total: 0, count: 0 }
      m.total += t.amount; m.count++
      byMerchant.set(k, m)
    }
    const merchants = [...byMerchant.values()].sort((a, b) => b.total - a.total).slice(0, 5)

    // Gasto acumulado por día: este mes vs el anterior.
    const prevMonth = shiftMonth(month, -1)
    const isCurrent = month === monthOf(today())
    const lastDay = isCurrent ? +today().slice(8) : daysInMonth(month)
    let a = 0, b = 0
    const pace = Array.from({ length: Math.max(daysInMonth(month), daysInMonth(prevMonth)) }, (_, i) => {
      const day = String(i + 1).padStart(2, '0')
      a += expenses.filter((t) => t.date.slice(8) === day).reduce((s, t) => s + t.amount, 0)
      b += txs.filter((t) => t.type === 'gasto' && t.date === `${prevMonth}-${day}`).reduce((s, t) => s + t.amount, 0)
      return { day: i + 1, actual: i < lastDay ? a : null, anterior: i < daysInMonth(prevMonth) ? b : null }
    })
    return { monthly, cur, prev, cats, merchants, pace, lastDay }
  }, [rawTxs, month, anchor])

  if (!d) return null
  const { cur, prev } = d
  const net = cur.ingresos - cur.gastos
  const rate = cur.ingresos > 0 ? net / cur.ingresos : null
  const change = (a: number, b: number) => (b > 0 ? `${a >= b ? '+' : '−'}${Math.abs(Math.round(((a - b) / b) * 100))}% vs mes anterior` : 'Sin datos del mes anterior')
  const empty = d.monthly.every((m) => m.ingresos === 0 && m.gastos === 0)
  const maxCat = d.cats[0]?.total ?? 1

  return (
    <>
      <header className="topbar">
        <div><p className="eyebrow">Resumen</p><h1>{monthLabel(month)}</h1></div>
        <div className="row topbar-actions"><MonthSwitch compact /><ThemeButton /><SettingsButton /></div>
      </header>

      {empty ? (
        <div className="card empty">
          <strong>Aún no hay movimientos</strong>
          <p>Sube tu estado de cuenta del Popular o agrega un gasto a mano.</p>
          <div className="row" style={{ justifyContent: 'center', maxWidth: 520, margin: '16px auto 0', flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={() => go('importar')}>Subir estado de cuenta</button>
            <button className="btn" onClick={() => edit()}>Agregar a mano</button>
            <button className="btn ghost" onClick={loadSample}>Ver con datos de ejemplo</button>
          </div>
        </div>
      ) : (
        <div className="grid">
          {alerts?.invest.ready && (
            <button className="notice" style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }} onClick={() => go('ahorro', 'invertir')}>
              <h3>Tienes {fmt(alerts.invest.investable)} que podrías poner a producir</h3>
              <p>Tu fondo de emergencia está cubierto. Mira opciones y simula cuánto podría generar →</p>
            </button>
          )}
          <section className="kpis" aria-label="Totales del mes">
            <div className="kpi"><div className="label"><span className="swatch" style={{ background: c.income }} />Ingresos</div><div className="value">{fmt(cur.ingresos)}</div><div className="delta">{change(cur.ingresos, prev.ingresos)}</div></div>
            <div className="kpi"><div className="label"><span className="swatch" style={{ background: c.expense }} />Gastos</div><div className="value">{fmt(cur.gastos)}</div><div className="delta">{change(cur.gastos, prev.gastos)}</div></div>
            <div className="kpi"><div className="label">Te quedó</div><div className={`value ${net < 0 ? 'expense' : ''}`}>{fmt(net)}</div><div className="delta">{net < 0 ? 'Gastaste más de lo que entró' : 'Disponible para ahorrar'}</div></div>
            <div className="kpi"><div className="label">Tasa de ahorro</div><div className="value">{rate == null ? '—' : `${Math.round(rate * 100)}%`}</div><div className="delta">Meta sana: 20% o más</div></div>
          </section>

          <div className="grid grid-2">
            <section className="card">
              <div className="card-head">
                <div><h2>Ingresos y gastos</h2><p>Últimos 6 meses. Toca un mes para verlo.</p></div>
                <div className="legend"><span><span className="swatch" style={{ background: c.income }} />Ingresos</span><span><span className="swatch" style={{ background: c.expense }} />Gastos</span></div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={d.monthly} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                  onClick={(s) => { const i = Number(s?.activeIndex); if (!Number.isNaN(i) && d.monthly[i]) setMonth(d.monthly[i].month) }}
                  style={{ cursor: 'pointer' }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: c.grid }} tick={{ fill: c.muted, fontSize: 12 }} />
                  <YAxis tickFormatter={fmtShort} tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 12 }} width={64} />
                  <Tooltip cursor={{ fill: c.grid, opacity: 0.5 }} content={<MonthTip />} />
                  {(['ingresos', 'gastos'] as const).map((k) => (
                    <Bar key={k} dataKey={k} fill={k === 'ingresos' ? c.income : c.expense} radius={[4, 4, 0, 0]} maxBarSize={28}>
                      {d.monthly.map((m) => <Cell key={m.month} fillOpacity={m.month === month ? 1 : 0.4} />)}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="card">
              <div className="card-head"><div><h2>En qué gastas</h2><p>Toca una categoría para ver sus movimientos.</p></div></div>
              {d.cats.length === 0 ? <p className="muted">Sin gastos este mes.</p> : (
                <ul className="catbars">
                  {d.cats.slice(0, 7).map((cat) => (
                    <li key={cat.id}>
                      <button className="catbar" onClick={() => go('movimientos', cat.id)}>
                        <span className="name">{categoryById(cat.id).label}</span>
                        <span className="amt">{fmt(cat.total)} <span className="pct">{Math.round((cat.total / cur.gastos) * 100)}%</span></span>
                        <span className="track"><span className="fill" style={{ width: `${(cat.total / maxCat) * 100}%`, display: 'block' }} /></span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid grid-2">
            <section className="card">
              <div className="card-head">
                <div><h2>Ritmo de gasto</h2><p>Gasto acumulado día a día contra el mes anterior.</p></div>
                <div className="legend">
                  <span><span className="line-key" style={{ background: c.expense }} />{monthLabel(month, 'short')}</span>
                  <span><span className="dash-key" style={{ borderColor: c.prev }} />{monthLabel(shiftMonth(month, -1), 'short')}</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={d.pace} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="day" tickLine={false} axisLine={{ stroke: c.grid }} tick={{ fill: c.muted, fontSize: 12 }} interval={4} />
                  <YAxis tickFormatter={fmtShort} tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 12 }} width={64} />
                  <Tooltip cursor={{ stroke: c.muted, strokeWidth: 1 }} content={<PaceTip month={month} />} />
                  <Area type="monotone" dataKey="actual" stroke={c.expense} strokeWidth={2} fill={c.expense} fillOpacity={0.12} dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} connectNulls={false} />
                  <Line type="monotone" dataKey="anterior" stroke={c.prev} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </section>

            <section className="card">
              <div className="card-head"><div><h2>Dónde más gastas</h2><p>Comercios con más gasto este mes.</p></div></div>
              {d.merchants.length === 0 ? <p className="muted">Sin gastos este mes.</p> : d.merchants.map((m, i) => (
                <div key={m.name} className="spread" style={{ padding: '10px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div className="muted" style={{ fontSize: 13 }}>{m.count} {m.count === 1 ? 'compra' : 'compras'}</div>
                  </div>
                  <span className="num">{fmt(m.total)}</span>
                </div>
              ))}
            </section>
          </div>

          {alerts && alerts.cardList.length > 0 && (
            <section className="card">
              <div className="card-head"><div><h2>Tarjetas de crédito</h2><p>Lo que debes pagar para no generar intereses.</p></div><button className="btn ghost" onClick={() => go('tarjetas')}>Ver tarjetas</button></div>
              <div className="grid grid-2-even">
                {alerts.cardList.map(({ card, s }) => (
                  <button key={card.id} className="catbar" onClick={() => go('tarjetas', card.id)}>
                    <span className="name">{card.name} ••{card.last4}</span>
                    <span className="amt">{fmt(s.toPay)}</span>
                    <span className="track"><span className={`fill${s.utilization >= 0.7 ? ' over' : ''}`} style={{ width: `${Math.min(100, Math.max(0, s.utilization * 100))}%`, display: 'block' }} /></span>
                    <span className="pct">{Math.round(s.utilization * 100)}% del límite usado</span>
                    <span className={`pct ${s.overdue ? 'expense' : ''}`}>{s.toPay === 0 ? 'Al día' : s.overdue ? 'Vencido' : `Vence en ${s.daysToDue} ${s.daysToDue === 1 ? 'día' : 'días'}`}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {goals.length > 0 && (
            <section className="card">
              <div className="card-head"><div><h2>Metas de ahorro</h2></div><button className="btn ghost" onClick={() => go('ahorro')}>Ver todas</button></div>
              <div className="grid grid-2-even">
                {goals.slice(0, 4).map((g) => (
                  <div key={g.id} className="goal">
                    <div className="spread"><span style={{ fontWeight: 500 }}>{g.name}</span><span className="num muted">{Math.min(100, Math.round((g.saved / g.target) * 100))}%</span></div>
                    <div className="progress" role="progressbar" aria-valuenow={Math.round((g.saved / g.target) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={g.name}><div style={{ width: `${Math.min(100, (g.saved / g.target) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  )
}

type TipProps = { active?: boolean; payload?: { value: number; payload: Record<string, number | string | null> }[] }

function MonthTip({ active, payload }: TipProps) {
  const { colors: c } = useApp()
  if (!active || !payload?.length) return null
  const p = payload[0].payload as { month: string; ingresos: number; gastos: number }
  return (
    <div className="tooltip">
      <div className="t-title">{monthLabel(p.month)}</div>
      <div className="t-row"><span><span className="swatch" style={{ background: c.income }} />Ingresos</span><span className="num">{fmt(p.ingresos)}</span></div>
      <div className="t-row"><span><span className="swatch" style={{ background: c.expense }} />Gastos</span><span className="num">{fmt(p.gastos)}</span></div>
      <div className="t-row" style={{ marginTop: 4 }}><span>Balance</span><span className="num">{fmt(p.ingresos - p.gastos)}</span></div>
    </div>
  )
}

function PaceTip({ active, payload, month }: TipProps & { month: string }) {
  const { colors: c } = useApp()
  if (!active || !payload?.length) return null
  const p = payload[0].payload as { day: number; actual: number | null; anterior: number | null }
  return (
    <div className="tooltip">
      <div className="t-title">Día {p.day}</div>
      {p.actual != null && <div className="t-row"><span><span className="swatch" style={{ background: c.expense }} />{monthLabel(month, 'short')}</span><span className="num">{fmt(p.actual)}</span></div>}
      {p.anterior != null && <div className="t-row"><span><span className="swatch" style={{ background: c.prev }} />{monthLabel(shiftMonth(month, -1), 'short')}</span><span className="num">{fmt(p.anterior)}</span></div>}
    </div>
  )
}
