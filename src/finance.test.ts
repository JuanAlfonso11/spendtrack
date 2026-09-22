// Autoverificación de tarjetas e inversión: `npm test`
import assert from 'node:assert/strict'
import { avgMonthlyExpense, cardStatus, cycle, dueAfter, investReadiness, project } from './finance.ts'
import type { Card, Tx } from './db.ts'
import { linesToDrafts } from './parse.ts'

// Ciclos de corte
assert.deepEqual(cycle(15, '2026-09-22'), { lastCut: '2026-09-15', nextCut: '2026-10-15' })
assert.deepEqual(cycle(25, '2026-09-22'), { lastCut: '2026-08-25', nextCut: '2026-09-25' })
assert.deepEqual(cycle(31, '2026-03-10'), { lastCut: '2026-02-28', nextCut: '2026-03-31' })
assert.deepEqual(cycle(5, '2026-01-03'), { lastCut: '2025-12-05', nextCut: '2026-01-05' })
assert.equal(dueAfter('2026-09-15', 8), '2026-10-08')
assert.equal(dueAfter('2026-09-05', 28), '2026-09-28')

// Estado de la tarjeta
const card: Card = { id: 1, name: 'Visa', last4: '1234', limit: 100000, closingDay: 15, dueDay: 8, adjust: 5000 }
const tx = (date: string, amount: number, type: Tx['type'], category = 'super', account = 1): Tx => ({ date, amount, type, category, description: 'x', source: 'manual', account })
const txs = [
  tx('2026-09-01', 10000, 'gasto'),
  tx('2026-09-10', 2000, 'gasto', 'comida'),
  tx('2026-09-18', 3000, 'gasto'), // ciclo nuevo
  tx('2026-09-20', 7000, 'ingreso', 'pago_recibido'), // pago después del corte
  tx('2026-09-19', 999, 'gasto', 'super', 2), // otra tarjeta
]
const s = cardStatus(card, txs, '2026-09-22')
assert.equal(s.balance, 5000 + 10000 + 2000 + 3000 - 7000)
assert.equal(s.toPay, 17000 - 7000)
assert.equal(s.due, '2026-10-08')
assert.equal(s.daysToDue, 16)
assert.equal(s.cycleSpend, 3000)
assert.equal(s.overdue, false)
assert.equal(cardStatus(card, txs, '2026-10-09').overdue, true)

// Saldo escrito hoy (después del corte): no está vencido; entra en el próximo corte
const fresh: Card = { ...card, id: 9, adjust: 12000, adjustDate: '2026-09-22' }
assert.equal(cardStatus(fresh, [], '2026-09-22').toPay, 0)
assert.equal(cardStatus(fresh, [], '2026-09-22').balance, 12000)
assert.equal(cardStatus(fresh, [], '2026-10-16').toPay, 12000)
assert.equal(cardStatus(fresh, [], '2026-10-16').due, '2026-11-08')

// Estado de cuenta de tarjeta: el balance sube con consumos, baja con pagos
const cardLines = linesToDrafts([
  'Balance anterior 1,000.00',
  '02/09/2026 SUPERMERCADOS NACIONAL 500.00 1,500.00',
  '05/09/2026 SU PAGO GRACIAS 1,000.00 500.00',
], [], true)
assert.equal(cardLines[0].type, 'gasto')
assert.equal(cardLines[1].type, 'ingreso')
assert.equal(cardLines[1].category, 'pago_recibido')
assert.equal(linesToDrafts(['03/09/2026 AMAZON -250.00'], [], true)[0].type, 'ingreso')
assert.equal(linesToDrafts(['03/09/2026 PAGO TARJETA CREDITO 5,000.00'])[0].category, 'pago_tarjeta')
assert.equal(linesToDrafts(['03/09/2026 PAGO TARJETA CREDITO 5,000.00'])[0].type, 'gasto')

// Inversión
const exp = avgMonthlyExpense([tx('2026-06-10', 30000, 'gasto'), tx('2026-07-10', 30000, 'gasto'), tx('2026-08-10', 30000, 'gasto'), tx('2026-08-11', 9000, 'gasto', 'pago_tarjeta'), tx('2026-09-10', 99999, 'gasto')], '2026-09-22')
assert.equal(exp, 30000)
const r = investReadiness(150000, 30000, 3, 25000)
assert.equal(r.emergency, 90000)
assert.equal(r.investable, 60000)
assert.equal(r.ready, true)
assert.equal(investReadiness(100000, 30000, 3, 25000).ready, false)
const p = project(10000, 1000, 12, 1)
assert.equal(p.length, 13)
assert.equal(p[12].saved, 22000)
assert.ok(Math.abs(p[12].invested - 23950.75) < 0.01)

console.log('finance: todas las pruebas pasaron')
