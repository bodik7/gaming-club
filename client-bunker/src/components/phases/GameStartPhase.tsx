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
    <>
      <div className="flex flex-col gap-3 animate-fade-up" style={{ paddingBottom: 96 }}>

        {/* Деталі сценарію */}
        <div className="rounded-xl overflow-hidden"
             style={{ border: '1px solid rgba(204,34,0,0.25)', background: 'var(--bunker-surface)' }}>
          <div className="px-4 py-3 flex flex-col gap-2 text-sm leading-relaxed"
               style={{ color: 'var(--bunker-text)' }}>
            <p><strong className="text-white">💀 Катастрофа:</strong> {scenario.disaster}</p>
            <p><strong className="text-white">🏚️ Бункер:</strong> {scenario.bunker}</p>
            <p><strong className="text-white">🎯 Завдання:</strong> {scenario.goal}</p>
          </div>
        </div>

        {/* Прогрес готовності */}
        <div className="rounded-xl px-4 py-3"
             style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
          <div className="flex justify-between items-center text-sm mb-2">
            <span style={{ color: 'var(--bunker-muted)' }}>Готові до гри</span>
            <span className="font-black text-base" style={{ color: 'var(--bunker-green-bright)' }}>
              {readyCount} / {players.length}
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'var(--bunker-border)' }}>
            <div className="h-full rounded-full transition-all duration-500"
                 style={{ width: `${pct}%`, background: 'var(--bunker-green-bright)' }} />
          </div>
        </div>
      </div>

      {/* Кнопка готовності — зафіксована внизу екрану */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: 'linear-gradient(to top, #0b0d0c 60%, transparent)',
        zIndex: 40,
      }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={!ready ? { scale: 1.01 } : {}}
          onClick={markReady}
          disabled={ready}
          className="w-full rounded-2xl font-black tracking-wide disabled:opacity-60"
          style={{
            padding: '20px 24px',
            fontSize: 20,
            maxWidth: 600,
            margin: '0 auto',
            display: 'block',
            background: ready
              ? 'linear-gradient(135deg, #1e4a2a, #162e1a)'
              : 'linear-gradient(135deg, #cc2200 0%, #8b1500 100%)',
            color: 'white',
            border: ready
              ? '1px solid rgba(60,140,80,0.3)'
              : '1px solid rgba(204,34,0,0.5)',
            boxShadow: ready
              ? 'none'
              : '0 4px 24px rgba(204,34,0,0.35), 0 0 0 1px rgba(204,34,0,0.15)',
            letterSpacing: '0.04em',
          }}
        >
          {ready ? '✅ Ви готові — чекаємо інших...' : '✅ Я прочитав — Готовий!'}
        </motion.button>
      </div>
    </>
  )
}
