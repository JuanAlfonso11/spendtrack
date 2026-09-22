import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db, getSettings, saveSettings, type Settings } from '../db.ts'
import { isTransfer } from '../categories.ts'
import { avgMonthlyExpense, investReadiness, project } from '../finance.ts'
import { fmt, fmtShort, monthOf, shiftMonth, today } from '../lib.ts'
import { useApp } from '../App.tsx'

// Información general de instrumentos comunes en RD. Sin tasas: cambian cada mes y cada entidad publica las suyas.
const OPTIONS = [
  { name: 'Cuenta de ahorro remunerada', risk: 1, liquidity: 'Inmediata', text: 'Tu dinero sigue disponible y gana un interés pequeño. Buena para el fondo de emergencia, no para hacerlo crecer.' },
  { name: 'Certificado financiero', risk: 1, liquidity: 'Al vencer el plazo', text: 'Depósito a plazo fijo en un banco o asociación de ahorros. Sabes desde el inicio cuánto vas a ganar; sacarlo antes suele tener penalidad.' },
  { name: 'Fondos de inversión abiertos', risk: 2, liquidity: 'Pocos días', text: 'Una administradora junta el dinero de muchas personas y lo invierte en instrumentos de renta fija. El rendimiento varía un poco día a día.' },
  { name: 'Bonos de Hacienda o del Banco Central', risk: 2, liquidity: 'Se venden en bolsa', text: 'Le prestas al Estado a cambio de intereses que te pagan cada cierto tiempo: un ingreso pasivo. Se compran a través de un puesto de bolsa.' },
  { name: 'Acciones y fondos indexados (ETF)', risk: 4, liquidity: 'Se venden en bolsa', text: 'Compras una parte de empresas. A largo plazo suelen rendir más, pero su valor sube y baja; solo con dinero que no vayas a necesitar en años.' },
  { name: 'Bienes raíces para alquilar', risk: 3, liquidity: 'Baja', text: 'El alquiler es un ingreso pasivo mensual. Requiere mucho capital, mantenimiento y tiempo para vender.' },
]

export default function Invest() {
  const { colors: c, go } = useApp()
  const settings = useLiveQuery(getSettings, [])
  const goalsSaved = useLiveQuery(async () => (await db.goals.toArray()).reduce((s, g) => s + g.saved, 0), []) ?? 0
  const stats = useLiveQuery(async () => {
    const now = today()
    const end = shiftMonth(monthOf(now), -1)
    const txs = await db.txs.where('date').between(shiftMonth(end, -2) + '-01', end + '-31', true, true).toArray()
    const net = txs.filter((t) => !isTransfer(t.category)).reduce((s, t) => s + (t.type === 'ingreso' ? t.amount : -t.amount), 0) / 3
    return { expense: avgMonthlyExpense(txs, now), net }
  }, [])

  if (!settings || !stats) return null
  const savings = settings.savings ?? goalsSaved
  const r = investReadiness(savings, stats.expense, settings.emergencyMonths, settings.investThreshold)

  return (
    <div className="grid">
      <section className="card">
        <div className="card-head"><div><h2>Tu dinero ahorrado</h2><p>Primero va el fondo de emergencia; lo que sobre es lo que puedes poner a producir.</p></div></div>
        <div className="row" style={{ flexWrap: 'wrap', alignItems: 'end' }}>
          <SettingInput label="Tengo ahorrado hoy (RD$)" value={savings} onSave={(v) => saveSettings({ savings: v })}
            hint={settings.savings == null ? 'Tomado de tus metas; cámbialo si tienes más.' : undefined} />
          <SettingInput label="Avísame si puedo invertir más de (RD$)" value={settings.investThreshold} onSave={(v) => saveSettings({ investThreshold: v })} />
          <label className="field" style={{ flex: 'none' }}>Fondo de emergencia
            <div className="segmented" role="group" aria-label="Meses de fondo de emergencia">
              {[3, 6].map((m) => <button key={m} aria-pressed={settings.emergencyMonths === m} onClick={() => saveSettings({ emergencyMonths: m })}>{m} meses</button>)}
            </div>
          </label>
        </div>
      </section>

      {stats.expense === 0 ? (
        <div className="notice"><h3>Necesito ver tus gastos</h3><p>Importa al menos un mes completo de movimientos para calcular tu fondo de emergencia.</p>
          <div><button className="btn primary" onClick={() => go('importar')}>Importar estado de cuenta</button></div></div>
      ) : r.emergencyPct < 1 ? (
        <div className="notice">
          <h3>Primero, tu fondo de emergencia</h3>
          <p>Gastas unos <strong className="num">{fmt(stats.expense)}</strong> al mes. Para {settings.emergencyMonths} meses necesitas <strong className="num">{fmt(r.emergency)}</strong> y tienes {fmt(savings)}. Cuando lo completes, lo que ahorres de más ya puede ponerse a producir.</p>
          <div className="progress" role="progressbar" aria-valuenow={Math.round(r.emergencyPct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Fondo de emergencia"><div style={{ width: `${r.emergencyPct * 100}%` }} /></div>
          <p style={{ fontSize: 13 }}>{Math.floor(r.emergencyPct * 100)}% completado · faltan {fmt(r.emergency - savings)}</p>
        </div>
      ) : r.ready ? (
        <div className="notice">
          <h3>Tienes {fmt(r.investable)} listos para invertir</h3>
          <p>Tu fondo de emergencia ({fmt(r.emergency)}) está cubierto. Ese excedente está quieto: si lo dejas en la cuenta es fácil gastarlo y la inflación le quita valor. Usa el simulador para ver cuánto podría generar.</p>
        </div>
      ) : (
        <div className="notice">
          <h3>Fondo de emergencia completo</h3>
          <p>Te sobran {fmt(r.investable)}. Te avisamos en el resumen cuando pases de {fmt(settings.investThreshold)} para invertir.</p>
        </div>
      )}

      <Simulator key={Math.round(r.investable)} initial={r.investable || savings} monthly={Math.max(0, Math.round(stats.net / 100) * 100)} settings={settings} colors={c} />

      <section className="card">
        <div className="card-head"><div><h2>Opciones comunes en República Dominicana</h2><p>De menor a mayor riesgo. Compara tasas y comisiones en varias entidades antes de decidir.</p></div></div>
        <div className="options">
          {OPTIONS.map((o) => (
            <div key={o.name} className="option">
              <h3>{o.name}</h3>
              <p>{o.text}</p>
              <div className="spread">
                <span className="meter" aria-label={`Riesgo ${o.risk} de 5`}>Riesgo {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= o.risk ? 'on' : ''} />)}</span>
                <span className="muted" style={{ fontSize: 12 }}>Liquidez: {o.liquidity}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="disclaimer" style={{ marginTop: 14 }}>
          Esto es información general para aprender, no una recomendación personalizada ni asesoría financiera. Antes de invertir verifica que la entidad esté regulada por la Superintendencia de Bancos o por la Superintendencia del Mercado de Valores (SIMV), y considera hablar con un asesor autorizado.
        </p>
      </section>
    </div>
  )
}

function SettingInput({ label, value, onSave, hint }: { label: string; value: number; onSave: (v: number) => void; hint?: string }) {
  const [v, setV] = useState(String(Math.round(value)))
  const commit = () => { const n = parseFloat(v.replace(/,/g, '')); if (n >= 0 && n !== value) onSave(n) }
  return (
    <label className="field" style={{ flex: '1 1 200px' }}>{label}
      <input className="input num" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
      {hint && <span className="muted" style={{ fontSize: 12 }}>{hint}</span>}
    </label>
  )
}

function Simulator({ initial, monthly, settings, colors: c }: { initial: number; monthly: number; settings: Settings; colors: ReturnType<typeof useApp>['colors'] }) {
  const [p, setP] = useState({ initial: String(Math.round(initial)), monthly: String(monthly), rate: String(settings.expectedRate), years: 5 })
  const n = (s: string) => Math.max(0, parseFloat(s.replace(/,/g, '')) || 0)
  const data = useMemo(() => project(n(p.initial), n(p.monthly), Math.min(50, n(p.rate)), p.years), [p])
  const end = data[data.length - 1]
  const gain = end.invested - end.saved
  const set = (k: 'initial' | 'monthly' | 'rate') => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: e.target.value })

  return (
    <section className="card">
      <div className="card-head">
        <div><h2>Simulador de crecimiento</h2><p>Interés compuesto mensual. Mueve los valores para comparar.</p></div>
        <div className="legend">
          <span><span className="line-key" style={{ background: c.income }} />Invertido</span>
          <span><span className="dash-key" style={{ borderColor: c.prev }} />Solo guardado</span>
        </div>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        <label className="field" style={{ flex: '1 1 140px' }}>Monto inicial (RD$)<input className="input num" inputMode="decimal" value={p.initial} onChange={set('initial')} /></label>
        <label className="field" style={{ flex: '1 1 140px' }}>Aporte mensual (RD$)<input className="input num" inputMode="decimal" value={p.monthly} onChange={set('monthly')} /></label>
        <label className="field" style={{ flex: '1 1 110px' }}>Rendimiento anual (%)<input className="input num" inputMode="decimal" value={p.rate} onChange={set('rate')} onBlur={() => saveSettings({ expectedRate: n(p.rate) })} /></label>
        <label className="field" style={{ flex: '1 1 160px' }}>Plazo: {p.years} {p.years === 1 ? 'año' : 'años'}
          <input type="range" min={1} max={20} value={p.years} onChange={(e) => setP({ ...p, years: +e.target.value })} style={{ accentColor: 'var(--accent)', minHeight: 44 }} />
        </label>
      </div>
      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi"><div className="label">Tendrías</div><div className="value income">{fmt(end.invested)}</div></div>
        <div className="kpi"><div className="label">Pusiste de tu bolsillo</div><div className="value">{fmt(end.saved)}</div></div>
        <div className="kpi"><div className="label">Generado por intereses</div><div className="value">{fmt(gain)}</div></div>
        <div className="kpi"><div className="label">Ingreso pasivo al final</div><div className="value">{fmt((end.invested * n(p.rate)) / 100 / 12)}</div><div className="delta">por mes, si retiras solo los intereses</div></div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="month" type="number" domain={[0, p.years * 12]} ticks={Array.from({ length: p.years + 1 }, (_, i) => i * 12).filter((_, i) => p.years <= 10 || i % 2 === 0)}
            tickFormatter={(m) => `${m / 12}a`} tickLine={false} axisLine={{ stroke: c.grid }} tick={{ fill: c.muted, fontSize: 12 }} />
          <YAxis tickFormatter={fmtShort} tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 12 }} width={64} />
          <Tooltip cursor={{ stroke: c.muted, strokeWidth: 1 }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload as (typeof data)[number]
            const y = Math.floor(d.month / 12), m = d.month % 12
            return (
              <div className="tooltip">
                <div className="t-title">{y ? `${y} ${y === 1 ? 'año' : 'años'}` : ''}{y && m ? ' y ' : ''}{m ? `${m} ${m === 1 ? 'mes' : 'meses'}` : ''}{!y && !m ? 'Hoy' : ''}</div>
                <div className="t-row"><span><span className="swatch" style={{ background: c.income }} />Invertido</span><span className="num">{fmt(d.invested)}</span></div>
                <div className="t-row"><span><span className="swatch" style={{ background: c.prev }} />Solo guardado</span><span className="num">{fmt(d.saved)}</span></div>
                <div className="t-row" style={{ marginTop: 4 }}><span>Diferencia</span><span className="num">{fmt(d.invested - d.saved)}</span></div>
              </div>
            )
          }} />
          <Area type="monotone" dataKey="invested" stroke={c.income} strokeWidth={2} fill={c.income} fillOpacity={0.12} dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="saved" stroke={c.prev} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <p className="chart-hint">Es una estimación con un rendimiento fijo; en la vida real las tasas cambian y algunas inversiones pueden perder valor.</p>
    </section>
  )
}
