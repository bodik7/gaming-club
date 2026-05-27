import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { getSocket } from '../../hooks/useSocket'
import type { BunkerPlayer } from '../../types/bunker'

const ATTR_ICONS: Record<string, string> = {
  profession: '💼', biology: '🧬', health: '❤️',
  hobby: '🎯', trait: '🧠', baggage: '🎒', fact: '🔐',
}
const ATTR_COLORS: Record<string, string> = {
  profession: '#e09600', biology: '#5cb87e', health: '#cc5555',
  hobby: '#6088cc', trait: '#aa88cc', baggage: '#cc8844', fact: '#48b0c8',
}
const ATTR_ORDER = ['profession', 'biology', 'health', 'hobby', 'trait', 'baggage', 'fact']

function PlayerRevealCard({ player, survived }: { player: BunkerPlayer; survived: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const revealedAttrs = ATTR_ORDER.map(k => [k, player.attributes[k as keyof typeof player.attributes]] as const)
    .filter(([, a]) => a?.isRevealed)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${survived ? 'rgba(60,150,100,0.3)' : 'rgba(150,150,150,0.15)'}`,
        opacity: survived ? 1 : 0.65,
      }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-left transition-all active:scale-98"
        style={{ background: survived ? 'rgba(42,122,42,0.12)' : 'rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 14 }}>{survived ? '🏆' : '💀'}</span>
          <span className="text-sm font-black text-white">{player.name}</span>
          {revealedAttrs.length > 0 && (
            <span className="text-xs px-1.5 py-px rounded-full"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--bunker-muted)', fontSize: 9 }}>
              {revealedAttrs.length} атр.
            </span>
          )}
        </div>
        <span style={{ color: 'var(--bunker-muted)', fontSize: 12, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </button>
      <AnimatePresence>
        {expanded && revealedAttrs.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            style={{ background: 'var(--bunker-surface)' }}
          >
            <div className="px-3 pb-3 pt-1 flex flex-col gap-1">
              {revealedAttrs.map(([key, attr]) => {
                const color = ATTR_COLORS[key] || '#e09600'
                return (
                  <div key={key} className="flex items-start gap-2 py-1 px-2 rounded-lg text-xs"
                       style={{ background: `${color}0c`, border: `1px solid ${color}20`, borderLeftWidth: 2, borderLeftColor: color }}>
                    <span className="flex-shrink-0 mt-px" style={{ fontSize: 11 }}>{ATTR_ICONS[key]}</span>
                    <span className="text-white leading-snug" style={{ fontSize: 11 }}>{attr?.value}</span>
                  </div>
                )
              })}
              {revealedAttrs.length < ATTR_ORDER.length && (
                <div className="text-xs text-center py-1" style={{ color: 'var(--bunker-muted)', fontSize: 9 }}>
                  + {ATTR_ORDER.length - revealedAttrs.length} прихованих атрибутів
                </div>
              )}
            </div>
          </motion.div>
        )}
        {expanded && revealedAttrs.length === 0 && (
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--bunker-muted)', background: 'var(--bunker-surface)' }}>
            Жоден атрибут не було розкрито
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function EndGamePhase() {
  const { gameState, myIndex, isHost, reset } = useGameStore()
  if (!gameState) return null

  const { players, winner, epilogue } = gameState
  const survived  = winner ? players.filter(p => winner.includes(p.id))  : []
  const eliminated = players.filter(p => !winner?.includes(p.id))
  const iSurvived = myIndex !== null && winner?.includes(myIndex)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${iSurvived ? 'rgba(60,150,100,0.4)' : 'rgba(204,34,0,0.3)'}` }}
    >
      {/* Результат */}
      <div className="p-4 text-center"
           style={{
             background: iSurvived
               ? 'linear-gradient(135deg, rgba(42,122,42,0.18) 0%, rgba(30,80,50,0.1) 100%)'
               : 'linear-gradient(135deg, rgba(204,34,0,0.14) 0%, rgba(100,10,0,0.08) 100%)',
           }}>
        <div className="text-4xl mb-2">{iSurvived ? '🏆' : '💀'}</div>
        <div className="text-base font-black text-white tracking-wide">
          {iSurvived ? 'Ви потрапили до бункера!' : 'Вас не пустили до бункера'}
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--bunker-muted2)' }}>
          {iSurvived ? 'Виживання підтверджено' : 'Гра завершена'}
        </div>
      </div>

      {/* Повні картки гравців — вижили потім вигнані */}
      <div className="px-3 py-3 flex flex-col gap-2" style={{ background: 'var(--bunker-surface)' }}>
        {/* Вижили */}
        {survived.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--bunker-green-bright)' }}>
              🏚️ У бункері ({survived.length})
            </div>
            {survived.map(p => (
              <PlayerRevealCard key={p.id} player={p} survived={true} />
            ))}
          </div>
        )}
        {/* Вигнані */}
        {eliminated.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="text-xs font-black uppercase tracking-widest" style={{ color: '#ff6060' }}>
              💀 Вигнані ({eliminated.length})
            </div>
            {eliminated.map(p => (
              <PlayerRevealCard key={p.id} player={p} survived={false} />
            ))}
          </div>
        )}
      </div>

      {/* Епілог */}
      <div className="px-4 py-3 flex flex-col gap-3" style={{ background: 'var(--bunker-surface)' }}>
        {epilogue ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl p-3"
            style={{ background: 'rgba(224,150,0,0.07)', border: '1px solid rgba(224,150,0,0.2)', borderLeftWidth: 3, borderLeftColor: 'rgba(224,150,0,0.7)' }}
          >
            <div className="text-xs font-black mb-2" style={{ color: 'var(--bunker-yellow)' }}>
              ✨ Через рік у бункері:
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--bunker-text)' }}>
              {epilogue}
            </p>
          </motion.div>
        ) : winner && (
          <div className="text-xs text-center py-2 flex items-center justify-center gap-2"
               style={{ color: 'var(--bunker-muted)' }}>
            <span className="inline-block"
                  style={{ animation: 'pulse-urgent 1.2s ease-in-out infinite' }}>⏳</span>
            Генеруємо епілог...
          </div>
        )}
      </div>

      {/* Кнопки */}
      <div className="px-4 pb-4 pt-2 flex gap-2" style={{ background: 'var(--bunker-surface)' }}>
        {isHost && (
          <button onClick={() => getSocket().emit('restartGame')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #cc2200, #992000)',
                    color: 'white',
                    boxShadow: '0 2px 10px rgba(204,34,0,0.25)',
                  }}>
            🔄 Реванш
          </button>
        )}
        {!isHost && (
          <div className="flex-1 py-2.5 text-xs text-center rounded-xl"
               style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--bunker-muted)', border: '1px solid var(--bunker-border)' }}>
            Чекаємо реваншу від хоста...
          </div>
        )}
        <button onClick={() => {
                  localStorage.removeItem('monopolia_session')
                  getSocket().emit('leaveRoom')
                  reset()
                  location.replace('/')
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--bunker-muted2)', border: '1px solid var(--bunker-border)' }}>
          🏠 Нова гра
        </button>
      </div>
    </motion.div>
  )
}
