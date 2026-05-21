import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { getSocket } from '../../hooks/useSocket'

export function EndGamePhase() {
  const { gameState, myIndex, isHost, reset } = useGameStore()
  if (!gameState) return null

  const { players, winner, epilogue } = gameState
  const survived  = winner ? players.filter(p => winner.includes(p.id)) : []
  const eliminated = players.filter(p => !winner?.includes(p.id))
  const iSurvived = myIndex !== null && winner?.includes(myIndex)

  return (
    <div className="rounded-xl flex flex-col gap-3 overflow-hidden"
         style={{ border: '1px solid var(--bunker-border)' }}>

      {/* Результат */}
      <div className="p-4 text-center"
           style={{ background: iSurvived ? 'rgba(42,122,42,0.12)' : 'rgba(204,34,0,0.08)' }}>
        <div className="text-3xl mb-1">{iSurvived ? '🏆' : '💀'}</div>
        <div className="text-base font-black text-white">
          {iSurvived ? 'Ви потрапили до бункера!' : 'Вас не пустили до бункера'}
        </div>
      </div>

      <div className="px-4 flex flex-col gap-2">
        {/* Вижили */}
        <div>
          <div className="text-xs font-bold mb-1" style={{ color: '#7dd87d' }}>
            🏚️ Хто вижив ({survived.length}):
          </div>
          {survived.map(p => (
            <div key={p.id} className="text-sm py-0.5 px-2 text-white">
              {p.name} — {p.attributes.profession.value.split('(')[0].trim()}
            </div>
          ))}
        </div>

        {/* Вигнані */}
        {eliminated.length > 0 && (
          <div>
            <div className="text-xs font-bold mb-1" style={{ color: 'var(--bunker-muted)' }}>
              💀 Вигнані:
            </div>
            {eliminated.map(p => (
              <div key={p.id} className="text-xs px-2" style={{ color: 'var(--bunker-muted)', textDecoration: 'line-through' }}>
                {p.name}
              </div>
            ))}
          </div>
        )}

        {/* Епілог від Gemini */}
        {epilogue ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-3 text-xs leading-relaxed"
            style={{ background: 'rgba(245,196,0,0.08)', border: '1px solid rgba(245,196,0,0.2)', color: 'var(--bunker-text)' }}
          >
            <div className="text-xs font-bold mb-1" style={{ color: 'var(--bunker-yellow)' }}>
              ✨ Епілог — через рік у бункері:
            </div>
            {epilogue}
          </motion.div>
        ) : winner && (
          <div className="text-xs text-center py-2" style={{ color: 'var(--bunker-muted)' }}>
            ⏳ Генеруємо епілог...
          </div>
        )}
      </div>

      {/* Кнопки */}
      <div className="px-4 pb-4 flex gap-2">
        {isHost && (
          <button onClick={() => getSocket().emit('restartGame')}
                  className="flex-1 py-2 rounded-xl text-sm font-black transition-all active:scale-95"
                  style={{ background: 'var(--bunker-red)', color: 'white' }}>
            🔄 Реванш
          </button>
        )}
        {!isHost && (
          <div className="flex-1 py-2 text-xs text-center rounded-xl"
               style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--bunker-muted)' }}>
            Чекаємо реваншу від хоста...
          </div>
        )}
        <button onClick={() => { getSocket().emit('leaveRoom'); reset() }}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid var(--bunker-border)' }}>
          🏠 Нова гра
        </button>
      </div>
    </div>
  )
}
