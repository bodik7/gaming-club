import { getSocket } from '../../hooks/useSocket'
import { useGameStore } from '../../store/gameStore'

export function GameStartPhase() {
  const { gameState, isHost } = useGameStore()
  if (!gameState) return null
  const { scenario, bunkerCapacity, players } = gameState

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3"
         style={{ background: 'rgba(204,34,0,0.08)', border: '1px solid rgba(204,34,0,0.3)' }}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{scenario.emoji}</span>
        <div>
          <div className="font-black text-white text-sm">{scenario.title}</div>
          <div className="text-xs" style={{ color: 'var(--bunker-muted)' }}>{scenario.subtitle}</div>
        </div>
      </div>

      <div className="text-xs leading-relaxed" style={{ color: 'var(--bunker-text)' }}>
        <p className="mb-2"><strong className="text-white">💀 Катастрофа:</strong> {scenario.disaster}</p>
        <p className="mb-2"><strong className="text-white">🏚️ Бункер:</strong> {scenario.bunker}</p>
        <p><strong className="text-white">🎯 Завдання:</strong> {scenario.goal}</p>
      </div>

      <div className="text-center py-2 rounded-lg text-sm font-bold"
           style={{ background: 'rgba(245,196,0,0.1)', color: 'var(--bunker-yellow)' }}>
        Виживе {bunkerCapacity} з {players.length} гравців
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--bunker-muted)' }}>
        Ознайомтеся зі своїми характеристиками. Гра почнеться автоматично.
      </p>
    </div>
  )
}
