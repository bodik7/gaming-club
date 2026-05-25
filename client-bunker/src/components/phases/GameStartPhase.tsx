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
    <div className="game-start-fixed-btn" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 40,
      padding: '0 16px',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      background: 'linear-gradient(to top, #0b0d0c 70%, transparent)',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Деталі сценарію */}
        <div className="rounded-xl px-4 py-2.5 text-xs leading-relaxed"
             style={{ background: 'var(--bunker-surface)', border: '1px solid rgba(204,34,0,0.2)', color: 'var(--bunker-text)' }}>
          <p className="mb-1"><strong className="text-white">💀</strong> {scenario.disaster}</p>
          <p className="mb-1"><strong className="text-white">🏚️</strong> {scenario.bunker}</p>
          <p><strong className="text-white">🎯</strong> {scenario.goal}</p>
        </div>

        {/* Прогрес готовності */}
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'var(--bunker-border)' }}>
            <div className="h-full rounded-full transition-all duration-500"
                 style={{ width: `${pct}%`, background: 'var(--bunker-green-bright)' }} />
          </div>
          <span className="text-xs font-black flex-shrink-0" style={{ color: 'var(--bunker-green-bright)' }}>
            {readyCount} / {players.length} готові
          </span>
        </div>

        {/* Кнопка */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={!ready ? { scale: 1.01 } : {}}
          onClick={markReady}
          disabled={ready}
          className="w-full rounded-xl font-black tracking-wide disabled:opacity-60"
          style={{
            padding: '13px 20px',
            fontSize: 15,
            background: ready
              ? 'linear-gradient(135deg, #1e4a2a, #162e1a)'
              : 'linear-gradient(135deg, #cc2200 0%, #8b1500 100%)',
            color: 'white',
            border: ready
              ? '1px solid rgba(60,140,80,0.3)'
              : '1px solid rgba(204,34,0,0.5)',
            boxShadow: ready ? 'none' : '0 4px 20px rgba(204,34,0,0.3)',
            letterSpacing: '0.04em',
          }}
        >
          {ready ? '✅ Ви готові — чекаємо інших...' : '✅ Я прочитав — Готовий!'}
        </motion.button>
      </div>
    </div>
  )
}
