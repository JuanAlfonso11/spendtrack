// Cálculos puros de tarjetas e inversión (probados en finance.test.ts).
import type { Card, Tx } from './db.ts'
import { isTransfer } from './categories.ts'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// Día `day` del mes `m` (base 0); si el mes es más corto, el último día.
const onDay = (y: number, m: number, day: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()))
export const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00').getTime() - new Date(a + 'T12:00').getTime()) / 86400000)

// Último corte (hoy incluido) y el siguiente.
export function cycle(closingDay: number, today: string) {
  const [y, m, d] = today.split('-').map(Number)
  const thisMonth = onDay(y, m - 1, closingDay)
  const last = d >= thisMonth.getDate() ? thisMonth : onDay(y, m - 2, closingDay)
  return { lastCut: iso(last), nextCut: iso(onDay(last.getFullYear(), last.getMonth() + 1, closingDay)) }
}

// Fecha límite de pago del estado que cerró en `cut`: el primer `dueDay` después del corte.
export function dueAfter(cut: string, dueDay: number) {
  const [y, m, d] = cut.split('-').map(Number)
  const same = onDay(y, m - 1, dueDay)
  return iso(same.getDate() > d ? same : onDay(y, m, dueDay))
}

const signed = (t: Tx) => (t.type === 'gasto' ? t.amount : -t.amount)
const sum = (list: Tx[], f: (t: Tx) => number) => list.reduce((s, t) => s + f(t), 0)

export function cardStatus(card: Card, txs: Tx[], today: string) {
  const mine = txs.filter((t) => t.account === card.id)
  const { lastCut, nextCut } = cycle(card.closingDay, today)
  const balance = card.adjust + sum(mine, signed)
  // El saldo escrito a mano entra al estado de cuenta en el primer corte después de escribirlo.
  const adjustInStatement = !card.adjustDate || card.adjustDate <= lastCut ? card.adjust : 0
  const statement = adjustInStatement + sum(mine.filter((t) => t.date <= lastCut), signed)
  const paidSinceCut = sum(mine.filter((t) => t.date > lastCut && t.type === 'ingreso'), (t) => t.amount)
  const toPay = Math.max(0, Math.round((statement - paidSinceCut) * 100) / 100)
  const due = dueAfter(lastCut, card.dueDay)
  const cycleSpend = sum(mine.filter((t) => t.date > lastCut && t.type === 'gasto' && !isTransfer(t.category)), (t) => t.amount)
  return {
    balance,
    available: card.limit - balance,
    utilization: card.limit > 0 ? balance / card.limit : 0,
    lastCut, nextCut, due, toPay, cycleSpend,
    daysToDue: daysBetween(today, due),
    overdue: toPay > 0 && today > due,
  }
}

/* ---------- Inversión ---------- */

// Gasto mensual promedio de los últimos `months` meses completos (sin pagos de tarjeta).
export function avgMonthlyExpense(txs: Tx[], today: string, months = 3) {
  const [y, m] = today.split('-').map(Number)
  const from = iso(new Date(y, m - 1 - months, 1))
  const to = iso(new Date(y, m - 1, 0))
  const spent = sum(txs.filter((t) => t.type === 'gasto' && !isTransfer(t.category) && t.date >= from && t.date <= to), (t) => t.amount)
  return spent / months
}

export function investReadiness(savings: number, monthlyExpense: number, emergencyMonths: number, threshold: number) {
  const emergency = monthlyExpense * emergencyMonths
  const investable = Math.max(0, savings - emergency)
  return { emergency, investable, emergencyPct: emergency > 0 ? Math.min(1, savings / emergency) : 1, ready: investable >= threshold && investable > 0 }
}

// Crecimiento mes a mes con interés compuesto mensual vs. solo guardar el dinero.
export function project(initial: number, monthly: number, annualRate: number, years: number) {
  const r = annualRate / 100 / 12
  const out = [{ month: 0, invested: initial, saved: initial }]
  let v = initial
  for (let i = 1; i <= years * 12; i++) {
    v = v * (1 + r) + monthly
    out.push({ month: i, invested: v, saved: initial + monthly * i })
  }
  return out
}
