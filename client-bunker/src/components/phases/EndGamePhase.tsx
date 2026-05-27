import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { getSocket } from '../../hooks/useSocket'

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

      {/* Вижили / Вигнані */}
      <div className="px-4 py-3 flex flex-col gap-3" style={{ background: 'var(--bunker-surface)' }}>

        <div className="flex gap-2">
          {/* Вижили */}
          <div className="flex-1 rounded-xl p-3"
               style={{ background: 'rgba(42,122,42,0.1)', border: '1px solid rgba(60,150,100,0.25)' }}>
            <div className="text-xs font-black mb-2" style={{ color: 'var(--bunker-green-bright)' }}>
              🏚️ У бункері ({survived.length})
            </div>
            {survived.map(p => (
              <div key={p.id} className="text-xs py-0.5 text-white flex items-center gap-1">
                <span style={{ color: 'var(--bunker-green-bright)', fontSize: 10 }}>✓</span>
                {p.name}
              </div>
            ))}
          </div>

          {/* Вигнані */}
          {eliminated.length > 0 && (
            <div className="flex-1 rounded-xl p-3"
                 style={{ background: 'rgba(204,34,0,0.07)', border: '1px solid rgba(204,34,0,0.2)' }}>
              <div className="text-xs font-black mb-2" style={{ color: '#ff6060' }}>
                💀 Вигнані ({eliminated.length})
              </div>
              {eliminated.map(p => (
                <div key={p.id} className="text-xs py-0.5"
                     style={{ color: 'var(--bunker-muted)', textDecoration: 'line-through' }}>
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Епілог */}
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
