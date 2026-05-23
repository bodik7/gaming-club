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

const ATTR_COLORS: Record<string, string> = {
  profession: '#e09600',
  biology:    '#5cb87e',
  health:     '#cc5555',
  hobby:      '#6088cc',
  trait:      '#aa88cc',
  baggage:    '#cc8844',
}

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
      <div className="rounded-xl p-4 text-center animate-fade-up"
           style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
        <div className="text-3xl mb-2">✅</div>
        <div className="text-sm text-white font-bold">Ви вже розкрили атрибут</div>
        <div className="text-xs mt-1" style={{ color: 'var(--bunker-muted)' }}>
          Чекаємо інших гравців...
        </div>
      </div>
    )
  }

  if (forced) {
    const attr  = me.attributes[forced as keyof typeof me.attributes]
    const color = ATTR_COLORS[forced] || 'var(--bunker-yellow)'
    return (
      <div className="rounded-xl overflow-hidden animate-fade-up"
           style={{ border: `1px solid ${color}40` }}>
        <div className="px-4 py-2 text-xs font-black uppercase tracking-widest"
             style={{ background: `${color}14`, color }}>
          Раунд {round} · Обов'язкове розкриття
        </div>
        <div className="p-4 flex flex-col gap-3" style={{ background: 'var(--bunker-surface)' }}>
          <div className="px-3 py-3 rounded-xl"
               style={{ background: `${color}0e`, border: `1px solid ${color}30`, borderLeftWidth: 3 }}>
            <div className="text-xs font-bold mb-1" style={{ color: `${color}cc` }}>{ATTR_LABELS[forced]}</div>
            <div className="text-sm text-white font-medium">{attr.value}</div>
          </div>
          <button onClick={() => reveal(forced)}
                  className="py-2.5 rounded-xl font-black text-sm transition-all active:scale-95"
                  style={{
                    background: `linear-gradient(135deg, ${color}cc, ${color}88)`,
                    color: '#0b0d0c',
                    boxShadow: `0 2px 10px ${color}40`,
                  }}>
            🔓 Розкрити для всіх
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden animate-fade-up"
         style={{ border: '1px solid rgba(224,150,0,0.25)' }}>
      <div className="px-4 py-2 text-xs font-black uppercase tracking-widest"
           style={{ background: 'rgba(224,150,0,0.1)', color: 'var(--bunker-yellow)' }}>
        Раунд {round} · Оберіть що розкрити
      </div>
      <div className="p-3 flex flex-col gap-2" style={{ background: 'var(--bunker-surface)' }}>
        {hidden.map(key => {
          const attr  = me.attributes[key as keyof typeof me.attributes]
          const color = ATTR_COLORS[key] || '#e09600'
          const isSel = selected === key
          return (
            <button key={key}
                    onClick={() => setSelected(key === selected ? null : key)}
                    className="text-left px-3 py-2.5 rounded-xl transition-all"
                    style={{
                      background: isSel ? `${color}14` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSel ? color + '50' : 'var(--bunker-border)'}`,
                      borderLeftWidth: isSel ? 3 : 1,
                      borderLeftColor: isSel ? color : 'var(--bunker-border)',
                    }}>
              <div className="text-xs font-bold" style={{ color: isSel ? color : 'var(--bunker-muted2)' }}>
                {ATTR_LABELS[key]}
              </div>
              <div className="text-sm text-white mt-0.5">{attr.value}</div>
            </button>
          )
        })}
        {selected && (
          <button onClick={() => reveal(selected)}
                  className="py-2.5 rounded-xl font-black text-sm transition-all active:scale-95 mt-1"
                  style={{
                    background: 'linear-gradient(135deg, #cc2200, #992000)',
                    color: 'white',
                    boxShadow: '0 2px 10px rgba(204,34,0,0.3)',
                  }}>
            🔓 Розкрити «{ATTR_LABELS[selected]}»
          </button>
        )}
      </div>
    </div>
  )
}
