import { useState } from 'react'
import { getSocket } from '../../hooks/useSocket'
import { useGameStore } from '../../store/gameStore'

export function GameStartPhase() {
  const { gameState } = useGameStore()
  const [ready, setReady] = useState(false)
  if (!gameState) return null

  const { scenario, bunkerCapacity, players } = gameState
  const readyCount = players.filter(p => p.hasRevealed).length
  const pct = Math.round((readyCount / players.length) * 100)

  const markReady = () => {
    if (ready) return
    setReady(true)
    getSocket().emit('action', { type: 'b_ready', data: {} })
  }

  return (
    <div className="rounded-xl overflow-hidden animate-fade-up"
         style={{ border: '1px solid rgba(204,34,0,0.3)', boxShadow: '0 0 20px rgba(204,34,0,0.08)' }}>

      {/* Шапка */}
      <div className="p-4 flex items-start gap-3"
           style={{ background: 'linear-gradient(135deg, rgba(204,34,0,0.12) 0%, rgba(130,20,0,0.06) 100%)' }}>
        <span className="text-4xl flex-shrink-0">{scenario.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-black text-white text-base leading-tight tracking-wide">{scenario.title}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--bunker-muted2)' }}>{scenario.subtitle}</div>
        </div>
        <div className="text-center flex-shrink-0">
          <div className="text-2xl font-black" style={{ color: 'var(--bunker-yellow)', lineHeight: 1 }}>
            {bunkerCapacity}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--bunker-muted)' }}>місць</div>
        </div>
      </div>

      {/* Деталі сценарію */}
      <div className="px-4 py-3 flex flex-col gap-2 text-xs leading-relaxed"
           style={{ background: 'var(--bunker-surface)', color: 'var(--bunker-text)', borderTop: '1px solid var(--bunker-border)' }}>
        <p><strong className="text-white">💀 Катастрофа:</strong> {scenario.disaster}</p>
        <p><strong className="text-white">🏚️ Бункер:</strong> {scenario.bunker}</p>
        <p><strong className="text-white">🎯 Завдання:</strong> {scenario.goal}</p>
      </div>

      {/* Місця та прогрес */}
      <div className="px-4 py-3 flex flex-col gap-2"
           style={{ background: 'var(--bunker-surface)', borderTop: '1px solid var(--bunker-border)' }}>
        <div className="flex justify-between items-center text-xs">
          <span style={{ color: 'var(--bunker-muted)' }}>Готові до гри</span>
          <span className="font-bold" style={{ color: 'var(--bunker-yellow)' }}>{readyCount} / {players.length}</span>
        </div>
        {/* Прогрес-бар */}
        <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'var(--bunker-border)' }}>
          <div className="h-full rounded-full transition-all duration-500"
               style={{ width: `${pct}%`, background: 'var(--bunker-green-bright)' }} />
        </div>
      </div>

      {/* Кнопка */}
      <div className="px-4 pb-4 pt-2"
           style={{ background: 'var(--bunker-surface)' }}>
        <button
          onClick={markReady}
          disabled={ready}
          className="w-full py-3 rounded-xl font-black text-sm tracking-wide transition-all active:scale-95 disabled:opacity-50"
          style={{
            background: ready
              ? 'linear-gradient(135deg, #2a5a3a, #1e4a2a)'
              : 'linear-gradient(135deg, #cc2200, #992000)',
            color: 'white',
            boxShadow: ready ? 'none' : '0 2px 12px rgba(204,34,0,0.3)',
          }}
        >
          {ready ? '✅ Ви готові — чекаємо інших...' : '✅ Я прочитав — Готовий!'}
        </button>
      </div>
    </div>
  )
}
