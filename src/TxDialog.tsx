import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CATEGORIES, type TxType } from './categories.ts'
import { db, learnRule, type Tx } from './db.ts'
import { categorize } from './parse.ts'
import { today } from './lib.ts'
import { useApp } from './App.tsx'
import { Icon } from './icons.tsx'

export default function TxDialog({ initial, onClose }: { initial: Partial<Tx>; onClose: () => void }) {
  const { toast } = useApp()
  const ref = useRef<HTMLDialogElement>(null)
  const [type, setType] = useState<TxType>(initial.type ?? 'gasto')
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount) : '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [date, setDate] = useState(initial.date ?? today())
  const [category, setCategory] = useState(initial.category ?? '')
  const [touched, setTouched] = useState(Boolean(initial.category))
  const [account, setAccount] = useState(initial.account != null ? String(initial.account) : '')
  const cards = useLiveQuery(() => db.cards.toArray(), []) ?? []

  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? []
  const past = useLiveQuery(() => db.txs.orderBy('date').reverse().limit(400).toArray(), []) ?? []
  const suggestions = useMemo(() => [...new Set(past.map((t) => t.description))].slice(0, 60), [past])
  const guess = categorize(description, type, rules)

  useEffect(() => { ref.current?.showModal() }, [])
  // Autocompleta la categoría mientras se escribe, hasta que el usuario la elige a mano.
  useEffect(() => { if (!touched) setCategory(guess) }, [guess, touched])

  const onDescription = (value: string) => {
    setDescription(value)
    const prev = past.find((t) => t.description === value)
    if (prev && !initial.id) { setType(prev.type); setCategory(prev.category); setTouched(true) }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const value = parseFloat(amount.replace(/,/g, ''))
    if (!(value > 0)) return toast('Escribe un monto mayor que cero')
    const tx: Tx = { date, amount: value, type, category: category || guess, description: description.trim() || 'Sin descripción', source: initial.source ?? 'manual', account: account ? +account : undefined }
    if (initial.id) await db.txs.update(initial.id, tx)
    else await db.txs.add(tx)
    if (description.trim() && tx.category !== categorize(description, type, [])) await learnRule(description, tx.category)
    toast(initial.id ? 'Movimiento actualizado' : 'Movimiento guardado')
    onClose()
  }

  async function remove() {
    if (!initial.id || !confirm('¿Eliminar este movimiento?')) return
    await db.txs.delete(initial.id)
    toast('Movimiento eliminado')
    onClose()
  }

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}>
      <form onSubmit={save}>
        <div className="spread">
          <h2>{initial.id ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
          <button type="button" className="btn ghost icon-btn" aria-label="Cerrar" onClick={() => ref.current?.close()}><Icon name="x" /></button>
        </div>
        <div className="segmented" role="group" aria-label="Tipo">
          {(['gasto', 'ingreso'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => { setType(t); setTouched(false) }}>
              {t === 'gasto' ? 'Gasto' : 'Ingreso'}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="sr-only">Monto en pesos</span>
          <input className="input amount-input num" inputMode="decimal" placeholder="RD$0.00" autoFocus value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} />
        </label>
        <label className="field">Descripción
          <input className="input" list="desc-list" placeholder="Ej. Supermercado Nacional" value={description} onChange={(e) => onDescription(e.target.value)} />
          <datalist id="desc-list">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <div className="row">
          <label className="field">Categoría
            <select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setTouched(true) }}>
              {CATEGORIES.filter((c) => c.type === type).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="field">Fecha
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
        {cards.length > 0 && (
          <label className="field">{type === 'gasto' ? 'Pagado con' : 'Entró a'}
            <select className="input" value={account} onChange={(e) => setAccount(e.target.value)}>
              <option value="">Cuenta bancaria</option>
              {cards.map((c) => <option key={c.id} value={c.id}>{c.name} ···{c.last4}</option>)}
            </select>
          </label>
        )}
        <div className="row">
          {initial.id && <button type="button" className="btn danger" onClick={remove}>Eliminar</button>}
          <button className="btn primary">{initial.id ? 'Guardar cambios' : 'Guardar'}</button>
        </div>
      </form>
    </dialog>
  )
}
