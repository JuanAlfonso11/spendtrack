import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CATEGORIES } from '../categories.ts'
import { db, learnRule, type Tx } from '../db.ts'
import { categorize, dedupeKey, linesToDrafts, merchantKey, parseCSV, rowsToDrafts, textToDrafts, type Draft } from '../parse.ts'
import { fmt } from '../lib.ts'
import { useApp } from '../App.tsx'
import { Icon } from '../icons.tsx'

type Row = Draft & { key: number; on: boolean; dup: boolean; touched: boolean }

async function readPdf(file: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const data = new Uint8Array(await file.arrayBuffer())
  let doc
  for (let password: string | undefined; ; ) {
    try { doc = await pdfjs.getDocument({ data: data.slice(), password }).promise; break }
    catch (e) {
      if ((e as Error).name !== 'PasswordException') throw e
      const p = prompt(password === undefined ? 'Este PDF tiene contraseña. Escríbela para abrirlo (no se guarda):' : 'Contraseña incorrecta. Intenta de nuevo:')
      if (p === null) throw new Error('Se canceló la contraseña del PDF')
      password = p
    }
  }
  const lines: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    // Agrupa los fragmentos de texto por su altura en la página para reconstruir las filas.
    const rows = new Map<number, { x: number; s: string }[]>()
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue
      const y = Math.round(it.transform[5] / 3) * 3
      rows.set(y, [...(rows.get(y) ?? []), { x: it.transform[4], s: it.str }])
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a))
      lines.push(rows.get(y)!.sort((a, b) => a.x - b.x).map((p) => p.s).join('  '))
  }
  return lines
}

async function readFile(file: File, rules: { match: string; category: string }[], card: boolean): Promise<Draft[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return linesToDrafts(await readPdf(file), rules, card)
  if (/\.(xlsx|xls|ods)$/.test(name)) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer())
    for (const sheet of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheet], { header: 1, raw: true, defval: '' })
      const drafts = rowsToDrafts(rows, rules, card)
      if (drafts.length) return drafts
    }
    return []
  }
  const text = await file.text()
  return name.endsWith('.csv') ? rowsToDrafts(parseCSV(text), rules, card) : textToDrafts(text, rules, card)
}

export default function Import() {
  const { toast, go, setMonth, sub } = useApp()
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? []
  // '' = cuenta bancaria; si no, el id de la tarjeta.
  const [account, setAccount] = useState(sub ?? '')
  const isCard = account !== ''
  const accountName = isCard ? (cards.find((c) => String(c.id) === account)?.name ?? 'Tarjeta') : 'Cuenta bancaria'
  const input = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load(get: (rules: { match: string; category: string }[]) => Promise<Draft[]>, label: string) {
    setBusy(true); setError(null)
    try {
      const rules = await db.rules.toArray()
      const drafts = await get(rules)
      if (!drafts.length) {
        setError('No encontré movimientos. Revisa que el archivo tenga fechas y montos, o pega el texto de la tabla abajo.')
        return
      }
      const dates = drafts.map((d) => d.date).sort()
      const existing = new Set((await db.txs.where('date').between(dates[0], dates.at(-1)!, true, true).toArray())
        .filter((t) => (t.account ?? '') === (isCard ? +account : '')).map(dedupeKey))
      const seen = new Set<string>()
      setRows(drafts.map((d, key) => {
        const k = dedupeKey(d)
        const dup = existing.has(k) || seen.has(k)
        seen.add(k)
        return { ...d, key, dup, on: !dup, touched: false }
      }))
      setSource(label)
    } catch (e) {
      setError((e as Error).message || 'No se pudo leer el archivo')
    } finally { setBusy(false) }
  }

  const onFile = (file?: File) => file && load((r) => readFile(file, r, isCard), file.name)
  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...p } : r)))

  // Al cambiar la categoría de un comercio, se aplica a los demás movimientos del mismo comercio.
  function setCategory(row: Row, category: string) {
    const k = merchantKey(row.description)
    setRows((rs) => rs!.map((r) => r.key === row.key || (!r.touched && r.type === row.type && k && merchantKey(r.description) === k) ? { ...r, category, touched: r.key === row.key || r.touched } : r))
  }
  function toggleType(row: Row) {
    const type = row.type === 'gasto' ? 'ingreso' : 'gasto'
    patch(row.key, { type, category: categorize(row.description, type) })
  }

  async function save() {
    const chosen = rows!.filter((r) => r.on)
    const txs: Tx[] = chosen.map(({ date, description, amount, type, category }) => ({ date, description, amount, type, category, source: 'import', account: isCard ? +account : undefined }))
    await db.txs.bulkAdd(txs)
    for (const r of chosen.filter((r) => r.touched)) await learnRule(r.description, r.category)
    toast(`${txs.length} movimientos importados`)
    setMonth(chosen.map((r) => r.date).sort().at(-1)!.slice(0, 7))
    setRows(null); setText('')
    go(isCard ? 'tarjetas' : 'resumen', isCard ? account : undefined)
  }

  if (rows) {
    const on = rows.filter((r) => r.on)
    const inc = on.filter((r) => r.type === 'ingreso').reduce((s, r) => s + r.amount, 0)
    const exp = on.filter((r) => r.type === 'gasto').reduce((s, r) => s + r.amount, 0)
    const dups = rows.filter((r) => r.dup).length
    return (
      <>
        <header className="topbar">
          <div><p className="eyebrow">Revisar importación · {accountName} · {source}</p><h1>{rows.length} movimientos encontrados</h1></div>
        </header>
        <div className="kpis" style={{ marginBottom: 14 }}>
          <div className="kpi"><div className="label">Seleccionados</div><div className="value">{on.length}</div></div>
          <div className="kpi"><div className="label">{isCard ? 'Pagos y abonos' : 'Ingresos'}</div><div className="value income">{fmt(inc)}</div></div>
          <div className="kpi"><div className="label">{isCard ? 'Consumos' : 'Gastos'}</div><div className="value">{fmt(exp)}</div></div>
          <div className="kpi"><div className="label">Duplicados</div><div className="value">{dups}</div><div className="delta">{dups ? 'Ya estaban guardados; desmarcados' : 'Ninguno'}</div></div>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Las categorías se llenaron solas según el comercio. Si corriges una, se aplica a los demás movimientos de ese comercio y la app lo recordará la próxima vez.
        </p>
        <div className="table-wrap">
          <table className="preview">
            <thead><tr><th><span className="sr-only">Incluir</span></th><th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Categoría</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={r.on ? '' : 'off'}>
                  <td><input type="checkbox" checked={r.on} onChange={(e) => patch(r.key, { on: e.target.checked })} aria-label={`Incluir ${r.description}`} /></td>
                  <td><input type="date" value={r.date} onChange={(e) => patch(r.key, { date: e.target.value })} aria-label="Fecha" /></td>
                  <td className="desc-cell">
                    <input value={r.description} onChange={(e) => patch(r.key, { description: e.target.value })} aria-label="Descripción" />
                    {r.dup && <span className="badge warn">Duplicado</span>}
                  </td>
                  <td><button className={`type-toggle ${r.type}`} onClick={() => toggleType(r)} title="Cambiar tipo">{r.type === 'gasto' ? 'Gasto' : 'Ingreso'}</button></td>
                  <td>
                    <select value={r.category} onChange={(e) => setCategory(r, e.target.value)} aria-label="Categoría">
                      {CATEGORIES.filter((c) => c.type === r.type).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className={`num ${r.type === 'ingreso' ? 'income' : ''}`} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{r.type === 'ingreso' ? '+' : '−'}{fmt(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn" style={{ flex: 'none' }} onClick={() => setRows(null)}>Cancelar</button>
          <button className="btn primary" style={{ flex: 'none' }} disabled={!on.length} onClick={save}>Importar {on.length} movimientos</button>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="topbar">
        <div><p className="eyebrow">Importar</p><h1>Sube tu estado de cuenta</h1></div>
      </header>
      <div className="grid grid-2">
        <div className="grid">
          <section className="card">
            <div className="card-head"><div><h2>¿De dónde es este estado de cuenta?</h2><p>{isCard ? 'En la tarjeta, los consumos suben la deuda y los pagos la bajan.' : 'Cuenta de ahorro o corriente.'}</p></div></div>
            <div className="chips" role="group" aria-label="Cuenta">
              <button className="chip" aria-pressed={!isCard} onClick={() => setAccount('')}>Cuenta bancaria</button>
              {cards.map((c) => <button key={c.id} className="chip" aria-pressed={account === String(c.id)} onClick={() => setAccount(String(c.id))}>{c.name} ···{c.last4}</button>)}
              <button className="chip" onClick={() => go('tarjetas')}>+ Agregar tarjeta</button>
            </div>
          </section>
          <label
            className={`drop ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files[0]) }}
          >
            <Icon name="file" />
            <strong>{busy ? 'Leyendo…' : 'Elige o arrastra un archivo'}</strong>
            <span className="muted">PDF, Excel o CSV descargado de Popular en Línea</span>
            <input ref={input} type="file" accept=".pdf,.csv,.xlsx,.xls,.ods,.txt" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {error && <div className="card" role="alert" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{error}</div>}

          <section className="card">
            <div className="card-head"><div><h2>O pega el texto</h2><p>Copia la tabla de movimientos de Popular en Línea, o las alertas de consumo que te llegan por correo o SMS (una alerta por bloque).</p></div></div>
            <textarea className="input" value={text} onChange={(e) => setText(e.target.value)}
              placeholder={'22/09/2026  SUPERMERCADOS NACIONAL  2,350.00  18,420.55\n\nConsumo por RD$1,250.00 en STARBUCKS con su tarjeta ***1234 el 21/09/2026'} />
            <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
              <button className="btn primary" style={{ flex: 'none' }} disabled={!text.trim() || busy} onClick={() => load(async (r) => textToDrafts(text, r, isCard), 'texto pegado')}>Leer movimientos</button>
            </div>
          </section>
        </div>

        <section className="card">
          <h2 style={{ marginBottom: 10 }}>Cómo descargar tu estado de cuenta</h2>
          <ol style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 8, color: 'var(--ink-2)' }}>
            <li>Entra a Popular en Línea o a la App Popular.</li>
            <li>Abre tu cuenta o tarjeta y busca <em>Estado de cuenta</em> o <em>Movimientos</em>.</li>
            <li>Descárgalo en PDF o Excel y súbelo aquí.</li>
            <li>Revisa la vista previa: las categorías se llenan solas y puedes corregirlas antes de guardar.</li>
          </ol>
          <p className="muted" style={{ fontSize: 13, marginTop: 16, marginBottom: 0 }}>
            El archivo se procesa en tu teléfono. No se envía a ningún servidor y SpendTrack nunca te pide tu usuario ni contraseña del banco.
          </p>
        </section>
      </div>
    </>
  )
}
