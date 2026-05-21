import { useGameStore } from '../../store/gameStore'
import { getSocket } from '../../hooks/useSocket'

export function EndGamePhase() {
  const { gameState, myIndex, isHost, reset } = useGameStore()
  if (!gameState) return null

  const { players, winner } = gameState
  const survived = winner ? players.filter(p => winner.includes(p.id)) : []
  const eliminated = players.filter(p => !winner?.includes(p.id))
  const iSurvived = myIndex !== null && winner?.includes(myIndex)

  return (
    <div className="rounded-xl p-4 flex flex-col gap-4"
         style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>

      <div className="text-center">
        <div className="text-3xl mb-2">{iSurvived ? '🏆' : '💀'}</div>
        <div className="text-lg font-black text-white">
          {iSurvived ? 'Ви потрапили до бункера!' : 'Вас не пустили до бункера'}
        </div>
      </div>

      <div>
        <div className="text-xs font-bold mb-2" style={{ color: '#7dd87d' }}>
          🏚️ Хто вижив ({survived.length}):
        </div>
        {survived.map(p => (
          <div key={p.id} className="text-sm py-1 px-2 rounded text-white">{p.name}</div>
        ))}
      </div>

      <div>
        <div className="text-xs font-bold mb-2" style={{ color: 'var(--bunker-muted)' }}>
          💀 Вигнані ({eliminated.length}):
        </div>
        {eliminated.map(p => (
          <div key={p.id} className="text-sm py-1 px-2 rounded"
               style={{ color: 'var(--bunker-muted)', textDecoration: 'line-through' }}>
            {p.name}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {isHost && (
          <button onClick={() => getSocket().emit('restartGame')}
                  className="flex-1 py-2 rounded-xl text-sm font-black transition-all active:scale-95"
                  style={{ background: 'var(--bunker-red)', color: 'white' }}>
            🔄 Реванш
          </button>
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
