// Lectura de estados de cuenta: filas (CSV/Excel), líneas de texto (PDF o pegado) y alertas.
// Todo es puro (sin DOM ni DB) para poder probarlo con `npm test`.
import { CATEGORIES, INCOME_HINTS, fallbackCategory, type TxType } from './categories.ts'

export type Draft = { date: string; description: string; amount: number; type: TxType; category: string }
export type Rule = { match: string; category: string }

export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

// Llave de comercio para reglas aprendidas: sin números, primeras 3 palabras.
export const merchantKey = (desc: string) =>
  normalize(desc).replace(/\b\d+\b/g, ' ').split(/\s+/).filter((w) => w.length > 1).slice(0, 3).join(' ')

const hasWord = (text: string, kw: string) => new RegExp(`(^| )${kw}( |$)`).test(text)

export function categorize(desc: string, type: TxType, rules: Rule[] = []): string {
  const text = normalize(desc)
  const key = merchantKey(desc)
  const learned = rules.find((r) => r.match && (key === r.match || text.includes(r.match)))
  if (learned) return learned.category
  const hit = CATEGORIES.find((c) => c.type === type && c.keywords.some((k) => hasWord(text, k)))
  return hit?.id ?? fallbackCategory(type)
}

const MONTHS: Record<string, number> = {
  ENE: 1, JAN: 1, FEB: 2, MAR: 3, ABR: 4, APR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, AUG: 8,
  SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12, DEC: 12,
}
const pad = (n: number) => String(n).padStart(2, '0')

// Acepta dd/mm/aaaa, dd-mm-aa, aaaa-mm-dd, "22 SEP 2026", "22-Sep-26". Devuelve aaaa-mm-dd o null.
export function parseDate(raw: string, fallbackYear = new Date().getFullYear()): string | null {
  const s = raw.trim().toUpperCase()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?(?!\d)/)
  if (m) return valid(year(m[3], fallbackYear), +m[2], +m[1])
  m = s.match(/^(\d{1,2})[\s\-/.]*([A-Z]{3})[A-Z]*\.?[\s\-/.]*(\d{2,4})?(?![A-Z])/)
  if (m && MONTHS[m[2]]) return valid(year(m[3], fallbackYear), MONTHS[m[2]], +m[1])
  return null
}
const year = (y: string | undefined, fb: number) => (!y ? fb : y.length === 2 ? 2000 + +y : +y)
const valid = (y: number, mo: number, d: number) =>
  mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y > 1990 && y < 2100 ? `${y}-${pad(mo)}-${pad(d)}` : null

// Montos estilo RD: "RD$1,234.56", "(1,234.56)", "1,234.56-", "-50.00", "1,234.56 DB".
const AMOUNT_RE = /(?:RD\$|US\$|\$)?\s?\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?-?(?:\s?(?:DB|CR))?(?![\d/])/g
export function parseAmount(raw: string | number): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  let s = raw.trim().toUpperCase()
  if (!/\d/.test(s)) return null
  let neg = /\s?DB$/.test(s)
  s = s.replace(/\s?(DB|CR)$/, '')
  if (/^\(.*\)$/.test(s) || s.includes('-')) neg = true
  const n = parseFloat(s.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? (neg ? -n : n) : null
}

// En la cuenta, un "PAGO TARJETA" es salida de dinero; en la tarjeta, cualquier "PAGO" es abono.
const guessType = (desc: string, card: boolean): TxType => {
  const t = normalize(desc)
  if (/\bPAGO\b/.test(t)) return card ? 'ingreso' : /PAGO (DE |A )?(TARJETA|TC)\b/.test(t) ? 'gasto' : INCOME_HINTS.some((h) => t.includes(h)) ? 'ingreso' : 'gasto'
  return INCOME_HINTS.some((h) => t.includes(h)) ? 'ingreso' : 'gasto'
}

// En la cuenta un monto negativo es salida; en la tarjeta es un abono (pago o devolución).
const draft = (date: string, description: string, signed: number, rules: Rule[], type?: TxType, card = false): Draft => {
  const t = type ?? (signed < 0 ? (card ? 'ingreso' : 'gasto') : guessType(description, card))
  return { date, description: description.replace(/\s+/g, ' ').trim(), amount: Math.abs(signed), type: t, category: categorize(description, t, rules) }
}

/* ---------- Filas (CSV / Excel) ---------- */

const COLS = {
  date: /FECHA|DATE/,
  desc: /DESCRIPCION|CONCEPTO|DETALLE|COMERCIO|DESCRIPTION|MERCHANT|NARRATIVA|TRANSACCION/,
  debit: /DEBITO|CARGO|RETIRO|DEBIT|CONSUMO/,
  credit: /CREDITO|ABONO|DEPOSITO|CREDIT/,
  amount: /MONTO|VALOR|IMPORTE|AMOUNT/,
  ref: /REFERENCIA|REF/,
}

export function rowsToDrafts(rows: (string | number)[][], rules: Rule[] = [], card = false): Draft[] {
  const headerIdx = rows.findIndex((r) => {
    const cells = r.map((c) => normalize(String(c)))
    return cells.some((c) => COLS.date.test(c)) && cells.some((c) => COLS.amount.test(c) || COLS.debit.test(c) || COLS.credit.test(c))
  })
  if (headerIdx === -1) return linesToDrafts(rows.map((r) => r.join('  ')), rules, card)

  const head = rows[headerIdx].map((c) => normalize(String(c)))
  const find = (re: RegExp, not?: RegExp) => head.findIndex((h) => re.test(h) && !(not && not.test(h)))
  const c = {
    date: find(COLS.date),
    desc: find(COLS.desc),
    debit: find(COLS.debit),
    credit: find(COLS.credit),
    amount: find(COLS.amount),
    ref: find(COLS.ref),
  }
  const out: Draft[] = []
  for (const r of rows.slice(headerIdx + 1)) {
    const date = cellDate(r[c.date])
    if (!date) continue
    const desc = String(r[c.desc] ?? r[c.ref] ?? '').trim() || 'Sin descripción'
    const debit = c.debit >= 0 ? parseAmount(String(r[c.debit] ?? '')) : null
    const credit = c.credit >= 0 ? parseAmount(String(r[c.credit] ?? '')) : null
    if (debit) out.push(draft(date, desc, Math.abs(debit), rules, 'gasto'))
    else if (credit) out.push(draft(date, desc, Math.abs(credit), rules, 'ingreso'))
    else if (c.amount >= 0) {
      const a = parseAmount(r[c.amount] as string)
      if (a) out.push(draft(date, desc, a, rules, undefined, card))
    }
  }
  return out
}

// Excel puede entregar fechas como número de serie (días desde 1899-12-30).
function cellDate(v: unknown): string | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000)
    return d.toISOString().slice(0, 10)
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return v == null ? null : parseDate(String(v))
}

/* ---------- Líneas de texto (PDF o pegado) ---------- */

const DATE_PREFIX = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?|\d{1,2}[\s\-/.]*[A-Za-z]{3}[A-Za-z]*\.?(?:[\s\-/.]*\d{4}|[\s\-/.]*\d{2}(?!\d))?)\s*/

export function linesToDrafts(lines: string[], rules: Rule[] = [], card = false): Draft[] {
  const out: Draft[] = []
  let prevBalance: number | null = null
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim()
    const date = parseDate(line)
    if (!date) continue
    // Quita la fecha inicial y una posible segunda fecha (fecha efectiva).
    let rest = line.replace(DATE_PREFIX, '')
    if (parseDate(rest)) rest = rest.replace(DATE_PREFIX, '')
    const amounts = [...rest.matchAll(AMOUNT_RE)].map((m) => ({ text: m[0], index: m.index! }))
    if (!amounts.length) continue
    const description = rest.slice(0, amounts[0].index).replace(/\b\d{6,}\b/g, '').trim() || 'Sin descripción'
    const first = parseAmount(amounts[0].text)!
    let type: TxType | undefined
    if (amounts.length >= 2) {
      // Última cifra = balance. En la cuenta, si subió fue ingreso; en la tarjeta (deuda), si subió fue consumo.
      const balance = parseAmount(amounts[amounts.length - 1].text)!
      if (prevBalance != null && Math.abs(Math.abs(balance - prevBalance) - Math.abs(first)) < 0.01)
        type = (balance > prevBalance) !== card ? 'ingreso' : 'gasto'
      prevBalance = balance
    }
    if (first === 0) continue
    out.push(draft(date, description, first, rules, type, card))
  }
  return out
}

/* ---------- Alertas de consumo (correo / SMS) ---------- */

// Ej.: "Consumo por RD$1,250.00 en SUPERMERCADOS NACIONAL con su tarjeta ***1234 el 22/09/2026"
export function alertToDraft(text: string, rules: Rule[] = []): Draft | null {
  const amount = text.match(/(?:RD\$|US\$|\$|DOP|USD)\s?([\d,]+\.\d{2})/i) ?? text.match(/([\d,]+\.\d{2})/)
  if (!amount) return null
  const merchant = text.match(/\ben\s+(.+?)(?=\s+(?:con|el|a las|por|desde|tarjeta|fecha)\b|[.,;]|$)/i)?.[1] ?? 'Alerta bancaria'
  const date = text.match(/\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?/)?.[0]
  const type: TxType = /deposit|credit|recib|abono|transferencia recibida/i.test(text) ? 'ingreso' : 'gasto'
  return draft(
    (date && parseDate(date)) || new Date().toISOString().slice(0, 10),
    merchant, parseFloat(amount[1].replace(/,/g, '')), rules, type,
  )
}

export function textToDrafts(text: string, rules: Rule[] = [], card = false): Draft[] {
  const fromLines = linesToDrafts(text.split(/\r?\n/), rules, card)
  if (fromLines.length) return fromLines
  return text.split(/\n\s*\n/).map((b) => alertToDraft(b, rules)).filter((d): d is Draft => d !== null)
}

export const dedupeKey = (d: { date: string; amount: number; description: string }) =>
  `${d.date}|${d.amount.toFixed(2)}|${normalize(d.description)}`

/* ---------- CSV ---------- */

export function parseCSV(text: string): string[][] {
  const sep = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = [[]]
  let cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === sep) { rows[rows.length - 1].push(cell); cell = '' }
    else if (ch === '\n') { rows[rows.length - 1].push(cell.replace(/\r$/, '')); rows.push([]); cell = '' }
    else cell += ch
  }
  rows[rows.length - 1].push(cell)
  return rows.filter((r) => r.some((c) => c.trim()))
}
