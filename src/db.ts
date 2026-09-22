import Dexie, { type EntityTable } from 'dexie'
import { Capacitor } from '@capacitor/core'
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
  account?: number // id de la tarjeta; vacío = cuenta bancaria
}
export type Card = {
  id?: number
  name: string
  last4: string
  limit: number
  closingDay: number // día de corte
  dueDay: number // fecha límite de pago
  adjust: number // saldo que no viene de movimientos importados (lo que ya debías)
  adjustDate?: string // cuándo se escribió ese saldo; entra al estado en el siguiente corte
}
export type Settings = { savings?: number; emergencyMonths: number; investThreshold: number; expectedRate: number }
export const DEFAULT_SETTINGS: Settings = { emergencyMonths: 3, investThreshold: 25000, expectedRate: 8 }
export type Goal = { id?: number; name: string; target: number; saved: number; deadline?: string; createdAt: string }
export type StoredRule = Rule & { id?: number }

export const db = new Dexie('spendtrack') as Dexie & {
  txs: EntityTable<Tx, 'id'>
  goals: EntityTable<Goal, 'id'>
  rules: EntityTable<StoredRule, 'id'>
  cards: EntityTable<Card, 'id'>
  settings: EntityTable<Settings & { key: string }, 'key'>
}
db.version(1).stores({ txs: '++id, date, category, type', goals: '++id', rules: '++id, &match' })
db.version(2).stores({ txs: '++id, date, category, type, account', cards: '++id', settings: 'key' })

export const getSettings = async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS, ...(await db.settings.get('main')) })
export const saveSettings = async (p: Partial<Settings>) => db.settings.put({ ...(await getSettings()), ...p, key: 'main' })

// Cuando el usuario corrige una categoría, se recuerda para ese comercio.
export async function learnRule(description: string, category: string) {
  const match = merchantKey(description)
  if (!match) return
  const existing = await db.rules.where('match').equals(match).first()
  if (existing) await db.rules.update(existing.id!, { category })
  else await db.rules.add({ match, category })
}

export async function exportBackup() {
  const data = { version: 1, exportedAt: new Date().toISOString(), txs: await db.txs.toArray(), goals: await db.goals.toArray(), rules: await db.rules.toArray(), cards: await db.cards.toArray(), settings: await db.settings.toArray() }
  const name = `spendtrack-${data.exportedAt.slice(0, 10)}.json`
  const json = JSON.stringify(data, null, 2)
  // En el APK no existen las descargas del navegador: se guarda el archivo y se abre "Compartir" de Android.
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const { uri } = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: 'Respaldo de SpendTrack', files: [uri] })
    return
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text())
  if (!Array.isArray(data.txs) || !Array.isArray(data.goals)) throw new Error('El archivo no es un respaldo de SpendTrack')
  await db.transaction('rw', [db.txs, db.goals, db.rules, db.cards, db.settings], async () => {
    await Promise.all([db.txs.clear(), db.goals.clear(), db.rules.clear(), db.cards.clear(), db.settings.clear()])
    await db.cards.bulkAdd(data.cards ?? [])
    await db.settings.bulkAdd(data.settings ?? [])
    await db.txs.bulkAdd(data.txs)
    await db.goals.bulkAdd(data.goals)
    await db.rules.bulkAdd(data.rules ?? [])
  })
}
