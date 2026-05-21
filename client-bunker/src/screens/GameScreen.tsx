import { useGameStore } from '../store/gameStore'
import { GameStartPhase }   from '../components/phases/GameStartPhase'
import { RoundRevealPhase } from '../components/phases/RoundRevealPhase'
import { DiscussionPhase }  from '../components/phases/DiscussionPhase'
import { VotingPhase }      from '../components/phases/VotingPhase'
import { EndGamePhase }     from '../components/phases/EndGamePhase'
import { PlayerGrid }       from '../components/PlayerGrid'
import { PhaseTimer }       from '../components/PhaseTimer'
import { ChatPanel }        from '../components/ChatPanel'
import { getSocket }        from '../hooks/useSocket'

export function GameScreen() {
  const { gameState, myIndex, reset } = useGameStore()
  if (!gameState) return null

  const { phase, scenario, bunkerCapacity, players } = gameState
  const alive = players.filter(p => p.isAlive).length
  const me    = myIndex !== null ? players[myIndex] : null

  const leaveGame = () => {
    if (confirm('Покинути гру? Гра буде скасована для всіх.')) {
      getSocket().emit('leaveRoom')
      reset()
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#111212' }}>

      {/* Topbar */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
           style={{ background: '#0a0a0a', borderBottom: '2px solid var(--bunker-red)' }}>
        <span className="text-lg">{scenario.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-white truncate">{scenario.title}</div>
          <div className="text-xs" style={{ color: 'var(--bunker-muted)' }}>
            Виживе {bunkerCapacity} з {players.length} · Живих: {alive}
          </div>
        </div>
        <PhaseTimer deadline={gameState.timeDeadline} />
        <button onClick={leaveGame}
                className="text-xs px-3 py-1 rounded-lg transition-opacity hover:opacity-70"
                style={{ background: 'rgba(204,34,0,0.3)', color: '#ff8080', border: '1px solid rgba(204,34,0,0.4)' }}>
          Вийти
        </button>
      </div>

      {/* Основний контент */}
      <div className="flex-1 flex gap-3 p-3 min-h-0 overflow-hidden">

        {/* Ліва колонка: сітка гравців */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-y-auto">
          <PlayerGrid />

          {/* Панель фази */}
          <div className="flex-shrink-0">
            {phase === 'game_start'    && <GameStartPhase />}
            {phase === 'round_reveal'  && <RoundRevealPhase />}
            {phase === 'discussion'    && <DiscussionPhase />}
            {(phase === 'voting' || phase === 'voting_result') && <VotingPhase />}
            {phase === 'end_game'      && <EndGamePhase />}
          </div>
        </div>

        {/* Права колонка: моя картка + чат */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-3">
          {me && <MyCard player={me} phase={phase} />}
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}

// Картка власного персонажа
function MyCard({ player, phase }: { player: ReturnType<typeof useGameStore>['gameState'] extends null ? never : ReturnType<typeof useGameStore>['gameState']['players'][0]; phase: string }) {
  const ATTR_LABELS: Record<string, string> = {
    profession: '💼 Професія',
    biology:    '🧬 Біологія',
    health:     '❤️ Здоров\'я',
    hobby:      '🎯 Хобі',
    trait:      '🧠 Риса',
    baggage:    '🎒 Багаж',
  }

  return (
    <div className="rounded-xl p-3 flex flex-col gap-2"
         style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
      <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--bunker-yellow)' }}>
        👤 Ваш персонаж
      </div>
      {Object.entries(player.attributes).map(([key, attr]) => (
        <div key={key} className="text-xs">
          <div className="font-bold mb-0.5" style={{ color: 'var(--bunker-muted)' }}>
            {ATTR_LABELS[key]}
          </div>
          <div className="text-white leading-snug">{attr.value}</div>
          {!attr.isRevealed && (
            <div className="text-xs mt-0.5" style={{ color: 'rgba(204,34,0,0.7)' }}>
              🔒 Приховано від інших
            </div>
          )}
        </div>
      ))}
      {player.actionCards.map(card => (
        <div key={card.id} className="rounded-lg px-2 py-1.5 text-xs mt-1"
             style={{ background: card.used ? 'rgba(255,255,255,0.04)' : 'rgba(245,196,0,0.1)',
                      border: `1px solid ${card.used ? 'transparent' : 'rgba(245,196,0,0.3)'}`,
                      opacity: card.used ? 0.5 : 1 }}>
          <span style={{ color: card.used ? 'var(--bunker-muted)' : 'var(--bunker-yellow)' }}>
            {card.name}
          </span>
          {card.desc && <div className="mt-0.5 text-gray-400">{card.desc}</div>}
        </div>
      ))}
    </div>
  )
}
