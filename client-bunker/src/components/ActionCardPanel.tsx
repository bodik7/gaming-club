import { useState } from 'react'
import { getSocket } from '../hooks/useSocket'
import { useGameStore } from '../store/gameStore'
import type { ActionCard } from '../types/bunker'
import { ACTION_CARD_PHASES } from '../constants/cardPhases'

// Карти що потребують вибору цілі
const NEEDS_TARGET = new Set(['act_lustr','act_bribe','act_ban','act_kum','act_quar','act_deport','act_bavovna','act_human'])

const PHASE_LABELS: Record<string, string> = {
  round_reveal: 'Розкриття',
  discussion:   'Обговорення',
  voting:       'Голосування',
  voting_result:'Результат',
}

function cardPhaseHint(cardId: string): string {
  const phases = (ACTION_CARD_PHASES as Record<string, string[]>)[cardId] || []
  return phases.map(p => PHASE_LABELS[p] || p).join(' / ')
}

function canPlayCard(cardId: string, phase: string): boolean {
  const allowed = (ACTION_CARD_PHASES as Record<string, string[]>)[cardId]
  return allowed ? allowed.includes(phase) : false
}

export function ActionCardPanel() {
  const { gameState, myIndex } = useGameStore()
  const [pending, setPending] = useState<ActionCard | null>(null)
  const [expanded, setExpanded] = useState(true)

  if (!gameState || myIndex === null) return null

  const me    = gameState.players[myIndex]
  const cards = me.actionCards                               // всі карти (і використані)
  if (cards.length === 0) return null

  const phase     = gameState.phase
  const available = cards.filter(c => !c.used && canPlayCard(c.id, phase))
  const others    = cards.filter(c => !c.used && !canPlayCard(c.id, phase))
  const used      = cards.filter(c => c.used)

  const useCard = (card: ActionCard, targetIdx?: number) => {
    getSocket().emit('action', { type: 'b_useCard', data: { cardId: card.id, target: targetIdx } })
    setPending(null)
  }

  const handleClick = (card: ActionCard) => {
    if (!canPlayCard(card.id, phase)) return
    if (NEEDS_TARGET.has(card.id)) {
      setPending(card)
    } else {
      useCard(card)
    }
  }

  const targets = gameState.players.filter(p => p.isAlive && p.id !== myIndex)

  return (
    <>
      <div className="rounded-xl overflow-hidden"
           style={{ border: `1px solid ${available.length > 0 ? 'rgba(245,196,0,0.35)' : 'rgba(245,196,0,0.15)'}` }}>

        {/* Заголовок */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5"
          style={{
            background: available.length > 0 ? 'rgba(245,196,0,0.1)' : 'rgba(245,196,0,0.04)',
            border: 'none', cursor: 'pointer',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">🃏</span>
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--bunker-yellow)' }}>
              Карти дій
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(245,196,0,0.15)', color: 'var(--bunker-yellow)' }}>
              {cards.filter(c => !c.used).length}
            </span>
            {available.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-black animate-pulse-urgent"
                    style={{ background: 'rgba(245,196,0,0.25)', color: '#ffe066', border: '1px solid rgba(245,196,0,0.4)' }}>
                {available.length} доступно!
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: 'var(--bunker-muted)' }}>{expanded ? '▲' : '▼'}</span>
        </button>

        {expanded && (
          <div className="p-2 flex flex-col gap-1.5" style={{ background: 'var(--bunker-surface)' }}>

            {/* Доступні зараз */}
            {available.map(card => (
              <button
                key={card.id}
                onClick={() => handleClick(card)}
                className="text-left px-3 py-2.5 rounded-xl text-xs transition-all active:scale-95 animate-fade-up"
                style={{
                  background: 'rgba(245,196,0,0.14)',
                  border: '1.5px solid rgba(245,196,0,0.45)',
                  color: 'white',
                  boxShadow: '0 0 10px rgba(245,196,0,0.1)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,196,0,0.24)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,196,0,0.14)'}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-sm" style={{ color: 'var(--bunker-yellow)' }}>{card.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-black"
                        style={{ background: 'rgba(245,196,0,0.2)', color: '#ffe066' }}>
                    ▶ Грати
                  </span>
                </div>
                {card.desc && <div className="opacity-75 leading-snug mt-0.5">{card.desc}</div>}
              </button>
            ))}

            {/* Інші (ще не в цій фазі) */}
            {others.map(card => (
              <div
                key={card.id}
                className="px-3 py-2 rounded-xl text-xs"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(245,196,0,0.1)',
                  color: 'var(--bunker-muted2)',
                  opacity: 0.7,
                }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold" style={{ color: 'rgba(245,196,0,0.6)' }}>{card.name}</span>
                  <span className="text-xs" style={{ color: 'var(--bunker-muted)', fontSize: 10 }}>
                    🕐 {cardPhaseHint(card.id)}
                  </span>
                </div>
                {card.desc && <div className="opacity-60 leading-snug mt-0.5">{card.desc}</div>}
              </div>
            ))}

            {/* Використані */}
            {used.map(card => (
              <div
                key={card.id}
                className="px-3 py-2 rounded-xl text-xs"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  opacity: 0.4,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold line-through" style={{ color: 'var(--bunker-muted)' }}>{card.name}</span>
                  <span className="text-xs" style={{ color: 'var(--bunker-muted)', fontSize: 10 }}>
                    ✓ використано
                  </span>
                </div>
              </div>
            ))}

          </div>
        )}
      </div>

      {/* Модалка вибору цілі */}
      {pending && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => setPending(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl overflow-hidden"
            style={{ background: 'var(--bunker-surface)', border: '1px solid rgba(245,196,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="hazard-stripe" style={{ opacity: 0.4 }} />
            <div className="p-5 flex flex-col gap-3">
              <div className="text-sm font-black" style={{ color: 'var(--bunker-yellow)' }}>
                {pending.name}
              </div>
              {pending.desc && (
                <div className="text-xs leading-snug px-3 py-2 rounded-lg"
                     style={{ background: 'rgba(245,196,0,0.08)', color: 'var(--bunker-muted2)',
                              border: '1px solid rgba(245,196,0,0.15)' }}>
                  {pending.desc}
                </div>
              )}
              <div className="text-xs font-bold" style={{ color: 'var(--bunker-muted)' }}>
                Оберіть гравця:
              </div>
              <div className="flex flex-col gap-1.5">
                {targets.map(p => (
                  <button
                    key={p.id}
                    onClick={() => useCard(pending, p.id)}
                    className="py-2.5 px-3 rounded-xl text-sm font-bold text-left transition-all active:scale-95"
                    style={{
                      background: 'rgba(204,34,0,0.12)',
                      border: '1px solid rgba(204,34,0,0.3)',
                      color: 'white',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(204,34,0,0.22)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(204,34,0,0.12)'}
                  >
                    👤 {p.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPending(null)}
                className="text-xs py-2 rounded-xl"
                style={{ color: 'var(--bunker-muted)', border: '1px solid var(--bunker-border)', background: 'transparent' }}
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
