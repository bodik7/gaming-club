import { useState } from 'react'
import { getSocket } from '../../hooks/useSocket'
import { useGameStore } from '../../store/gameStore'

const ATTR_LABELS: Record<string, string> = {
  profession: '💼 Професія',
  biology:    '🧬 Біологія',
  health:     '❤️ Здоров\'я',
  hobby:      '🎯 Хобі',
  trait:      '🧠 Риса характеру',
  baggage:    '🎒 Багаж',
}

// Раунд 1 → profession обов'язково, раунд 2 → biology, раунд 3+ → вільний вибір
const FORCED: Record<number, string> = { 1: 'profession', 2: 'biology' }

export function RoundRevealPhase() {
  const { gameState, myIndex } = useGameStore()
  const [selected, setSelected] = useState<string | null>(null)
  if (!gameState || myIndex === null) return null

  const { round, players } = gameState
  const me = players[myIndex]
  const forced = FORCED[round]
  const alreadyRevealed = me.hasRevealed

  const hidden = Object.entries(me.attributes)
    .filter(([, v]) => !v.isRevealed)
    .map(([k]) => k)

  const reveal = (attr: string) => {
    getSocket().emit('action', { type: 'b_revealAttr', data: { attr } })
  }

  if (alreadyRevealed) {
    return (
      <div className="rounded-xl p-4 text-center"
           style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
        <div className="text-2xl mb-2">✅</div>
        <div className="text-sm text-white font-bold">Ви вже розкрили атрибут</div>
        <div className="text-xs mt-1" style={{ color: 'var(--bunker-muted)' }}>
          Чекаємо інших гравців...
        </div>
      </div>
    )
  }

  if (forced) {
    const attr = me.attributes[forced as keyof typeof me.attributes]
    return (
      <div className="rounded-xl p-4 flex flex-col gap-3"
           style={{ background: 'var(--bunker-surface)', border: '1px solid rgba(245,196,0,0.3)' }}>
        <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--bunker-yellow)' }}>
          Раунд {round} — Обов'язкове розкриття
        </div>
        <div className="text-sm text-white">{ATTR_LABELS[forced]}</div>
        <div className="text-sm py-2 px-3 rounded-lg font-medium"
             style={{ background: 'rgba(245,196,0,0.1)', color: 'white' }}>
          {attr.value}
        </div>
        <button onClick={() => reveal(forced)}
                className="py-2 rounded-xl font-black text-sm transition-all active:scale-95"
                style={{ background: 'var(--bunker-red)', color: 'white' }}>
          🔓 Розкрити для всіх
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3"
         style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--bunker-yellow)' }}>
        Раунд {round} — Оберіть що розкрити
      </div>
      <div className="flex flex-col gap-2">
        {hidden.map(key => {
          const attr = me.attributes[key as keyof typeof me.attributes]
          return (
            <button key={key}
                    onClick={() => setSelected(key === selected ? null : key)}
                    className="text-left px-3 py-2 rounded-lg text-sm transition-all"
                    style={{
                      background: selected === key ? 'rgba(245,196,0,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${selected === key ? 'rgba(245,196,0,0.5)' : 'var(--bunker-border)'}`,
                      color: 'white',
                    }}>
              <div className="font-bold">{ATTR_LABELS[key]}</div>
              <div className="text-xs mt-0.5 opacity-70">{attr.value}</div>
            </button>
          )
        })}
      </div>
      {selected && (
        <button onClick={() => reveal(selected)}
                className="py-2 rounded-xl font-black text-sm transition-all active:scale-95"
                style={{ background: 'var(--bunker-red)', color: 'white' }}>
          🔓 Розкрити «{ATTR_LABELS[selected]}»
        </button>
      )}
    </div>
  )
}
