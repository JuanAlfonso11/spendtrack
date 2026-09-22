import { db, type Tx } from './db.ts'
import { categorize } from './parse.ts'
import { monthOf, shiftMonth, today } from './lib.ts'

// Seis meses de movimientos ficticios con cifras típicas en RD.
const SPENDS: [string, number, number][] = [
  // [descripción, monto base, veces por mes]
  ['SUPERMERCADOS NACIONAL', 3200, 4], ['JUMBO', 2100, 2], ['COLMADO LA ESQUINA', 450, 6],
  ['UBER TRIP', 380, 8], ['SHELL WINSTON CHURCHILL', 2000, 3],
  ['EDESUR DOMINICANA', 2800, 1], ['CLARO DOMINICANA', 1900, 1], ['CAASD', 450, 1],
  ['FARMACIA CAROL', 900, 1], ['NETFLIX.COM', 620, 1], ['SPOTIFY', 330, 1],
  ['STARBUCKS BLUE MALL', 390, 3], ['PEDIDOSYA', 950, 3], ['CARIBBEAN CINEMAS', 700, 1],
  ['AMAZON MKTPLACE', 2400, 1], ['COMISION MANEJO CUENTA', 150, 1],
]

export async function loadSample() {
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const now = today()
  const txs: Tx[] = []
  for (let i = 5; i >= 0; i--) {
    const m = shiftMonth(monthOf(now), -i)
    const maxDay = m === monthOf(now) ? +now.slice(8) : 28
    const at = (d: number) => `${m}-${String(Math.min(d, maxDay)).padStart(2, '0')}`
    const add = (description: string, amount: number, type: Tx['type'], day: number) =>
      txs.push({ date: at(day), description, amount: Math.round(amount * 100) / 100, type, category: categorize(description, type), source: 'import' })
    add('PAGO NOMINA EMPRESA ABC', 42000, 'ingreso', 15)
    if (maxDay >= 28) add('PAGO NOMINA EMPRESA ABC', 42000, 'ingreso', 28)
    if (rnd() > 0.6) add('TRANSFERENCIA RECIBIDA PROYECTO', 6000 + rnd() * 8000, 'ingreso', 10)
    for (const [desc, base, times] of SPENDS)
      for (let k = 0; k < times; k++) {
        const day = 1 + Math.floor(rnd() * 28)
        if (day <= maxDay) add(desc, base * (0.7 + rnd() * 0.6), 'gasto', day)
      }
  }
  await db.transaction('rw', db.txs, db.goals, async () => {
    await db.txs.bulkAdd(txs)
    if (!(await db.goals.count())) {
      await db.goals.bulkAdd([
        { name: 'Fondo de emergencia', target: 150000, saved: 48000, createdAt: now },
        { name: 'Viaje a Samaná', target: 35000, saved: 12500, deadline: `${shiftMonth(monthOf(now), 4)}-15`, createdAt: now },
      ])
    }
  })
}
