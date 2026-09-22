import Dexie, { type EntityTable } from 'dexie'
import type { TxType } from './categories.ts'
import { merchantKey, type Rule } from './parse.ts'

export type Tx = {
  id?: number
  date: string // aaaa-mm-dd
  amount: number // siempre positivo; `type` da el signo
  type: TxType
  category: string
  description: string
  source: 'manual' | 'import'
}
export type Goal = { id?: number; name: string; target: number; saved: number; deadline?: string; createdAt: string }
export type StoredRule = Rule & { id?: number }

export const db = new Dexie('spendtrack') as Dexie & {
  txs: EntityTable<Tx, 'id'>
  goals: EntityTable<Goal, 'id'>
  rules: EntityTable<StoredRule, 'id'>
}
db.version(1).stores({ txs: '++id, date, category, type', goals: '++id', rules: '++id, &match' })

// Cuando el usuario corrige una categoría, se recuerda para ese comercio.
export async function learnRule(description: string, category: string) {
  const match = merchantKey(description)
  if (!match) return
  const existing = await db.rules.where('match').equals(match).first()
  if (existing) await db.rules.update(existing.id!, { category })
  else await db.rules.add({ match, category })
}

export async function exportBackup() {
  const data = { version: 1, exportedAt: new Date().toISOString(), txs: await db.txs.toArray(), goals: await db.goals.toArray(), rules: await db.rules.toArray() }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `spendtrack-${data.exportedAt.slice(0, 10)}.json` })
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text())
  if (!Array.isArray(data.txs) || !Array.isArray(data.goals)) throw new Error('El archivo no es un respaldo de SpendTrack')
  await db.transaction('rw', db.txs, db.goals, db.rules, async () => {
    await Promise.all([db.txs.clear(), db.goals.clear(), db.rules.clear()])
    await db.txs.bulkAdd(data.txs)
    await db.goals.bulkAdd(data.goals)
    await db.rules.bulkAdd(data.rules ?? [])
  })
}
