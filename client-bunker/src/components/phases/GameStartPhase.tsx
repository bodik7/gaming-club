import { useState } from 'react'
import { motion } from 'framer-motion'
import { getSocket } from '../../hooks/useSocket'
import { useGameStore } from '../../store/gameStore'

export function GameStartPhase() {
  const { gameState } = useGameStore()
  const [ready, setReady] = useState(false)
  if (!gameState) return null

  const { scenario, players } = gameState
  const readyCount = players.filter(p => p.hasRevealed).length
  const pct = Math.round((readyCount / players.length) * 100)

  const markReady = () => {
    if (ready) return
    setReady(true)
    getSocket().emit('action', { type: 'b_ready', data: {} })
  }

  return (
    <div className="rounded-xl overflow-hidden animate-fade-up"
         style={{ border: '1px solid rgba(204,34,0,0.25)' }}>

      {/* Деталі сценарію — без дублювання назви з topbar */}
      <div className="px-4 py-3 flex flex-col gap-1.5 text-xs leading-relaxed"
           style={{ background: 'var(--bunker-surface)', color: 'var(--bunker-text)' }}>
        <p><strong className="text-white">💀 Катастрофа:</strong> {scenario.disaster}</p>
        <p><strong className="text-white">🏚️ Бункер:</strong> {scenario.bunker}</p>
        <p><strong className="text-white">🎯 Завдання:</strong> {scenario.goal}</p>
      </div>

      {/* Прогрес готовності */}
      <div className="px-4 py-2 flex flex-col gap-1.5"
           style={{ background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--bunker-border)' }}>
        <div className="flex justify-between items-center text-xs">
          <span style={{ color: 'var(--bunker-muted)' }}>Готові до гри</span>
          <span className="font-bold" style={{ color: 'var(--bunker-green-bright)' }}>
            {readyCount} / {players.length}
          </span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'var(--bunker-border)' }}>
          <div className="h-full rounded-full transition-all duration-500"
               style={{ width: `${pct}%`, background: 'var(--bunker-green-bright)' }} />
        </div>
      </div>

      {/* Кнопка */}
      <div className="px-4 py-3" style={{ background: 'var(--bunker-surface)', borderTop: '1px solid var(--bunker-border)' }}>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={markReady}
          disabled={ready}
          className="w-full py-2.5 rounded-xl font-black text-sm tracking-wide disabled:opacity-50"
          style={{
            background: ready
              ? 'linear-gradient(135deg, #2a5a3a, #1e4a2a)'
              : 'linear-gradient(135deg, #cc2200, #992000)',
            color: 'white',
            boxShadow: ready ? 'none' : '0 2px 10px rgba(204,34,0,0.25)',
          }}
        >
          {ready ? '✅ Ви готові — чекаємо інших...' : '✅ Я прочитав — Готовий!'}
        </motion.button>
      </div>
    </div>
  )
}
