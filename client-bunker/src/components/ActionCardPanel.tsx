import { useState } from 'react'
import { getSocket } from '../hooks/useSocket'
import { useGameStore } from '../store/gameStore'
import type { ActionCard } from '../types/bunker'
import { ACTION_CARD_PHASES } from '../constants/cardPhases'

// Карти що потребують вибору цілі
const NEEDS_TARGET = new Set(['act_lustr','act_bribe','act_ban','act_kum','act_quar','act_deport','act_bavovna','act_human'])

export function ActionCardPanel() {
  const { gameState, myIndex } = useGameStore()
  const [pending, setPending] = useState<ActionCard | null>(null)

  if (!gameState || myIndex === null) return null

  const me = gameState.players[myIndex]
  const available = me.actionCards.filter(c => !c.used && canPlayCard(c.id, gameState.phase))

  if (available.length === 0) return null

  const useCard = (card: ActionCard, targetIdx?: number) => {
    getSocket().emit('action', { type: 'b_useCard', data: { cardId: card.id, target: targetIdx } })
    setPending(null)
  }

  const handleClick = (card: ActionCard) => {
    if (NEEDS_TARGET.has(card.id)) {
      setPending(card)
    } else {
      useCard(card)
    }
  }

  const targets = gameState.players.filter(p => p.isAlive && p.id !== myIndex)

  return (
    <>
      <div className="rounded-xl p-3 flex flex-col gap-2"
           style={{ background: 'rgba(245,196,0,0.06)', border: '1px solid rgba(245,196,0,0.2)' }}>
        <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--bunker-yellow)' }}>
          🃏 Ваші карти дій
        </div>
        {available.map(card => (
          <button
            key={card.id}
            onClick={() => handleClick(card)}
            className="text-left px-3 py-2 rounded-lg text-xs transition-all active:scale-95"
            style={{
              background: 'rgba(245,196,0,0.12)',
              border: '1px solid rgba(245,196,0,0.3)',
              color: 'white',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,196,0,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,196,0,0.12)'}
          >
            <div className="font-bold" style={{ color: 'var(--bunker-yellow)' }}>{card.name}</div>
            {card.desc && <div className="mt-0.5 opacity-70">{card.desc}</div>}
          </button>
        ))}
      </div>

      {/* Модалка вибору цілі */}
      {pending && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setPending(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: 'var(--bunker-surface)', border: '1px solid rgba(245,196,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-sm font-black text-white">{pending.name}</div>
            <div className="text-xs" style={{ color: 'var(--bunker-muted)' }}>
              Оберіть гравця:
            </div>
            {targets.map(p => (
              <button
                key={p.id}
                onClick={() => useCard(pending, p.id)}
                className="py-2 px-3 rounded-lg text-sm font-bold text-left transition-all active:scale-95"
                style={{ background: 'rgba(204,34,0,0.15)', border: '1px solid rgba(204,34,0,0.3)', color: 'white' }}
              >
                👤 {p.name}
              </button>
            ))}
            <button onClick={() => setPending(null)}
                    className="text-xs py-2 rounded-lg"
                    style={{ color: 'var(--bunker-muted)', border: '1px solid var(--bunker-border)' }}>
              Скасувати
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function canPlayCard(cardId: string, phase: string): boolean {
  const allowed = (ACTION_CARD_PHASES as Record<string, string[]>)[cardId]
  return allowed ? allowed.includes(phase) : false
}
