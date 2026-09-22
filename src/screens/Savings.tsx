import { ThemeButton, useApp } from '../App.tsx'
import Goals from './Goals.tsx'
import Invest from './Invest.tsx'

export default function Savings() {
  const { sub, setSub } = useApp()
  const tab = sub === 'invertir' ? 'invertir' : 'metas'
  return (
    <>
      <header className="topbar">
        <div><p className="eyebrow">Ahorro</p><h1>{tab === 'metas' ? 'Metas de ahorro' : 'Pon tu dinero a producir'}</h1></div>
        <div className="row" style={{ flex: 'none' }}>
          <div className="segmented" role="tablist" aria-label="Sección">
            <button role="tab" aria-pressed={tab === 'metas'} aria-selected={tab === 'metas'} onClick={() => setSub(null)}>Metas</button>
            <button role="tab" aria-pressed={tab === 'invertir'} aria-selected={tab === 'invertir'} onClick={() => setSub('invertir')}>Invertir</button>
          </div>
          <ThemeButton />
        </div>
      </header>
      {tab === 'metas' ? <Goals /> : <Invest />}
    </>
  )
}
