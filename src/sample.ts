import { db, type Tx } from './db.ts'
import { categorize } from './parse.ts'
import { monthOf, shiftMonth, today } from './lib.ts'

// Seis meses de movimientos ficticios con cifras típicas en RD. `card` = se paga con la tarjeta.
const SPENDS: [string, number, number, boolean?][] = [
  // [descripción, monto base, veces por mes, con tarjeta]
  ['SUPERMERCADOS NACIONAL', 3200, 4], ['JUMBO', 2100, 2, true], ['COLMADO LA ESQUINA', 450, 6],
  ['UBER TRIP', 380, 8, true], ['SHELL WINSTON CHURCHILL', 2000, 3, true],
  ['EDESUR DOMINICANA', 2800, 1], ['CLARO DOMINICANA', 1900, 1], ['CAASD', 450, 1],
  ['FARMACIA CAROL', 900, 1], ['NETFLIX.COM', 620, 1, true], ['SPOTIFY', 330, 1, true],
  ['STARBUCKS BLUE MALL', 390, 3, true], ['PEDIDOSYA', 950, 3, true], ['CARIBBEAN CINEMAS', 700, 1, true],
  ['AMAZON MKTPLACE', 2400, 1, true], ['COMISION MANEJO CUENTA', 150, 1],
]

export async function loadSample() {
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const now = today()
  const cardId = (await db.cards.toArray())[0]?.id ??
    await db.cards.add({ name: 'Visa Popular', last4: '4821', limit: 80000, closingDay: 15, dueDay: 8, adjust: 0 })
  const txs: Tx[] = []
  for (let i = 5; i >= 0; i--) {
    const m = shiftMonth(monthOf(now), -i)
    const maxDay = m === monthOf(now) ? +now.slice(8) : 28
    const at = (d: number) => `${m}-${String(Math.min(d, maxDay)).padStart(2, '0')}`
    const add = (description: string, amount: number, type: Tx['type'], day: number, card = false) =>
      txs.push({ date: at(day), description, amount: Math.round(amount * 100) / 100, type, category: categorize(description, type), source: 'import', account: card ? cardId : undefined })
    add('PAGO NOMINA EMPRESA ABC', 42000, 'ingreso', 15)
    if (maxDay >= 28) add('PAGO NOMINA EMPRESA ABC', 42000, 'ingreso', 28)
    if (rnd() > 0.6) add('TRANSFERENCIA RECIBIDA PROYECTO', 6000 + rnd() * 8000, 'ingreso', 10)
    for (const [desc, base, times, card] of SPENDS)
      for (let k = 0; k < times; k++) {
        const day = 1 + Math.floor(rnd() * 28)
        if (day <= maxDay) add(desc, base * (0.7 + rnd() * 0.6), 'gasto', day, card)
      }
    // Pago de la tarjeta desde la cuenta: aparece en ambos lados y no cuenta como gasto.
    if (i > 0 && maxDay >= 8) {
      const paid = 14000 + rnd() * 4000
      add('PAGO TARJETA CREDITO 4821', paid, 'gasto', 7)
      add('SU PAGO GRACIAS', paid, 'ingreso', 7, true)
    }
  }
  await db.transaction('rw', db.txs, db.goals, async () => {
    await db.txs.bulkAdd(txs)
    if (!(await db.goals.count())) {
      await db.goals.bulkAdd([
        { name: 'Fondo de emergencia', target: 150000, saved: 180000, createdAt: now },
        { name: 'Viaje a Samaná', target: 35000, saved: 12500, deadline: `${shiftMonth(monthOf(now), 4)}-15`, createdAt: now },
      ])
    }
  })
}
