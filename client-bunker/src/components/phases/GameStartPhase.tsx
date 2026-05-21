import { useState } from 'react'
import { getSocket } from '../../hooks/useSocket'
import { useGameStore } from '../../store/gameStore'

export function GameStartPhase() {
  const { gameState } = useGameStore()
  const [ready, setReady] = useState(false)
  if (!gameState) return null

  const { scenario, bunkerCapacity, players } = gameState
  const readyCount = players.filter(p => p.hasRevealed).length

  const markReady = () => {
    if (ready) return
    setReady(true)
    getSocket().emit('action', { type: 'b_ready', data: {} })
  }

  return (
    <div className="rounded-xl flex flex-col gap-3 overflow-hidden"
         style={{ border: '1px solid rgba(204,34,0,0.35)' }}>

      {/* Шапка сценарію */}
      <div className="p-4 flex items-start gap-3"
           style={{ background: 'rgba(204,34,0,0.08)' }}>
        <span className="text-3xl flex-shrink-0">{scenario.emoji}</span>
        <div>
          <div className="font-black text-white text-sm leading-tight">{scenario.title}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--bunker-muted)' }}>{scenario.subtitle}</div>
        </div>
      </div>

      {/* Деталі */}
      <div className="px-4 pb-2 flex flex-col gap-2 text-xs leading-relaxed"
           style={{ color: 'var(--bunker-text)' }}>
        <p><strong className="text-white">💀 Катастрофа:</strong> {scenario.disaster}</p>
        <p><strong className="text-white">🏚️ Бункер:</strong> {scenario.bunker}</p>
        <p><strong className="text-white">🎯 Завдання:</strong> {scenario.goal}</p>
      </div>

      {/* Місця */}
      <div className="mx-4 text-center py-2 rounded-lg text-sm font-bold"
           style={{ background: 'rgba(245,196,0,0.1)', color: 'var(--bunker-yellow)' }}>
        Виживе {bunkerCapacity} з {players.length} гравців
      </div>

      {/* Лічильник готових */}
      {readyCount > 0 && (
        <div className="mx-4 text-xs text-center" style={{ color: 'var(--bunker-muted)' }}>
          Готові: {readyCount} / {players.length}
        </div>
      )}

      {/* Кнопка */}
      <div className="px-4 pb-4">
        <button
          onClick={markReady}
          disabled={ready}
          className="w-full py-3 rounded-xl font-black text-sm tracking-wide transition-all active:scale-95 disabled:opacity-50"
          style={{
            background: ready ? '#2a7a2a' : 'var(--bunker-red)',
            color: 'white',
          }}
        >
          {ready ? '✅ Ви готові — чекаємо інших...' : '✅ Я прочитав — Готовий!'}
        </button>
      </div>
    </div>
  )
}
