import { useGameStore } from '../store/gameStore'
import { GameStartPhase }    from '../components/phases/GameStartPhase'
import { RoundRevealPhase }  from '../components/phases/RoundRevealPhase'
import { DiscussionPhase }   from '../components/phases/DiscussionPhase'
import { VotingPhase }       from '../components/phases/VotingPhase'
import { EndGamePhase }      from '../components/phases/EndGamePhase'
import { PlayerGrid }        from '../components/PlayerGrid'
import { PhaseTimer }        from '../components/PhaseTimer'
import { ChatPanel }         from '../components/ChatPanel'
import { LogPanel }          from '../components/LogPanel'
import { ActionCardPanel }   from '../components/ActionCardPanel'
import { getSocket }         from '../hooks/useSocket'

const ATTR_LABELS: Record<string, string> = {
  profession: '💼 Професія',
  biology:    '🧬 Біологія',
  health:     '❤️ Здоров\'я',
  hobby:      '🎯 Хобі',
  trait:      '🧠 Риса',
  baggage:    '🎒 Багаж',
}

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
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#111212' }}>

      {/* Topbar */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
           style={{ background: '#0a0a0a', borderBottom: '2px solid var(--bunker-red)' }}>
        <span className="text-xl">{scenario.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-white truncate">{scenario.title}</div>
          <div className="text-xs" style={{ color: 'var(--bunker-muted)' }}>
            Виживе {bunkerCapacity} з {players.length} · Живих: {alive}
          </div>
        </div>
        <PhaseTimer deadline={gameState.timeDeadline} />
        <button onClick={leaveGame}
                className="text-xs px-3 py-1 rounded-lg"
                style={{ background: 'rgba(204,34,0,0.25)', color: '#ff8080', border: '1px solid rgba(204,34,0,0.4)' }}>
          Вийти
        </button>
      </div>

      {/* Тіло */}
      <div className="flex-1 flex gap-2 p-2 min-h-0 overflow-hidden">

        {/* Центр: сітка гравців + панель фази */}
        <div className="flex-1 flex flex-col gap-2 min-w-0 overflow-hidden">

          {/* Сітка суперників */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <PlayerGrid />
          </div>

          {/* Панель поточної фази */}
          <div className="flex-shrink-0">
            {phase === 'game_start'   && <GameStartPhase />}
            {phase === 'round_reveal' && <RoundRevealPhase />}
            {phase === 'discussion'   && <DiscussionPhase />}
            {(phase === 'voting' || phase === 'voting_result') && <VotingPhase />}
            {phase === 'end_game'     && <EndGamePhase />}
          </div>
        </div>

        {/* Права колонка */}
        <div className="w-60 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">

          {/* Моя картка */}
          {me && (
            <div className="rounded-xl p-3 flex-shrink-0"
                 style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
              <div className="text-xs font-black uppercase tracking-widest mb-2"
                   style={{ color: 'var(--bunker-yellow)' }}>
                👤 Ваш персонаж
              </div>
              <div className="flex flex-col gap-1.5">
                {Object.entries(me.attributes).map(([key, attr]) => (
                  <div key={key} className="text-xs">
                    <div className="font-bold mb-0.5" style={{ color: 'var(--bunker-muted)' }}>
                      {ATTR_LABELS[key]}
                    </div>
                    <div className="text-white leading-snug">{attr.value}</div>
                    {!attr.isRevealed && (
                      <div className="text-xs" style={{ color: 'rgba(204,34,0,0.6)' }}>🔒 приховано</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Карти дій (тільки якщо є доступні) */}
          <ActionCardPanel />

          {/* Лог подій */}
          <LogPanel />

          {/* Чат */}
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}
