import { useState } from 'react'
import { getSocket } from '../../hooks/useSocket'
import { useGameStore } from '../../store/gameStore'
import { haptic } from '../../utils/haptic'
import { sounds } from '../../utils/sounds'

export function VotingPhase() {
  const { gameState, myIndex, isHost } = useGameStore()
  const [voted, setVoted] = useState(false)
  const [pendingVote, setPendingVote] = useState<number | null>(null)
  if (!gameState || myIndex === null) return null

  const { players, votes, phase, tiebreaker, timerEnabled, quarantined } = gameState
  const me           = players[myIndex]
  const isDead       = me && !me.isAlive
  const myVote       = votes[myIndex]
  const isTie        = !!tiebreaker
  const isQuarantined = quarantined?.includes(myIndex)

  // Кандидати: при перепроголосуванні — тільки учасники нічиї
  const alive = players.filter(p =>
    p.isAlive && p.id !== myIndex && (!isTie || tiebreaker!.includes(p.id))
  )

  const vote = (targetIdx: number) => {
    if (voted || myVote !== undefined) return
    // Перший тап — виділяємо кандидата; другий тап — підтверджуємо
    if (pendingVote === targetIdx) {
      getSocket().emit('action', { type: 'b_vote', data: { target: targetIdx } })
      setVoted(true)
      setPendingVote(null)
      haptic('heavy')
      sounds.vote()
    } else {
      setPendingVote(targetIdx)
      haptic('light')
    }
  }

  const endVoting = () => {
    getSocket().emit('action', { type: 'b_endVoting', data: {} })
  }

  const voteCounts: Record<number, number> = {}
  Object.values(votes).forEach(t => { voteCounts[t] = (voteCounts[t] || 0) + 1 })

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0)
  const maxVotes   = Math.max(0, ...Object.values(voteCounts))

  // Заголовок
  const headerBg    = isTie ? 'rgba(200,100,0,0.18)' : 'rgba(204,34,0,0.15)'
  const headerColor = isTie ? '#e09600' : 'var(--bunker-red)'
  const borderColor = isTie ? 'rgba(200,100,0,0.5)' : 'rgba(204,34,0,0.35)'
  const headerText  = isTie
    ? '⚖️ Повторне голосування — нічия!'
    : '🗳️ Голосування — хто залишає бункер?'

  // Мертвий гравець бачить тільки результати, не може голосувати
  if (isDead) {
    return (
      <div className="phase-fixed-panel">
        <div className="px-4 py-3 rounded-xl text-xs text-center animate-fade-up"
             style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--bunker-border)', color: 'var(--bunker-muted)' }}>
          👁 Ви вибули — спостерігаєте за голосуванням
        </div>
      </div>
    )
  }

  // Карантинований гравець не може голосувати
  if (isQuarantined && phase === 'voting') {
    return (
      <div className="phase-fixed-panel">
        <div className="px-4 py-3 rounded-xl text-xs text-center animate-fade-up"
             style={{ background: 'rgba(80,0,80,0.12)', border: '1px solid rgba(150,60,220,0.3)', color: '#cc88ff' }}>
          🏥 Ви в карантині — не можете голосувати цього раунду
        </div>
      </div>
    )
  }

  return (
    <div className="phase-fixed-panel">
    <div className="rounded-xl overflow-hidden animate-fade-up"
         style={{ border: `1px solid ${borderColor}`, boxShadow: '0 0 16px rgba(204,34,0,0.06)' }}>

      <div className="px-4 py-2 text-xs font-black uppercase tracking-widest"
           style={{ background: headerBg, color: headerColor }}>
        {headerText}
      </div>

      {isTie && (
        <div className="px-4 py-2 text-xs"
             style={{ background: 'rgba(200,100,0,0.08)', color: '#c8a060', borderBottom: '1px solid rgba(200,100,0,0.2)' }}>
          Голосуйте між гравцями що набрали однакову кількість голосів.
          При повторній нічиї — виганяються обидва.
        </div>
      )}

      <div className="p-3 flex flex-col gap-2" style={{ background: 'var(--bunker-surface)' }}>

        {phase === 'voting_result' ? (
          /* Результати */
          <div className="flex flex-col gap-1.5">
            {players
              .filter(p => p.isAlive)
              .sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0))
              .map(p => {
                const cnt   = voteCounts[p.id] || 0
                const isMax = cnt === maxVotes && maxVotes > 0
                const pct   = totalVotes > 0 ? (cnt / totalVotes) * 100 : 0
                return (
                  <div key={p.id}
                       className="flex flex-col gap-1 px-3 py-2 rounded-xl"
                       style={{
                         background: isMax ? 'rgba(204,34,0,0.15)' : 'rgba(255,255,255,0.03)',
                         border: `1px solid ${isMax ? 'rgba(204,34,0,0.4)' : 'var(--bunker-border)'}`,
                       }}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">{p.name}</span>
                        {quarantined?.includes(p.id) && (
                          <span className="text-xs px-1.5 py-px rounded font-black"
                                style={{ background: 'rgba(80,0,80,0.4)', color: '#cc88ff', fontSize: 9 }}>
                            🏥 карантин
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-black"
                            style={{ color: isMax ? 'var(--bunker-red)' : 'var(--bunker-muted2)' }}>
                        {cnt} {cnt === 1 ? 'голос' : 'голосів'}
                      </span>
                    </div>
                    {totalVotes > 0 && (
                      <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'var(--bunker-border)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                             style={{
                               width: `${pct}%`,
                               background: isMax ? 'var(--bunker-red)' : 'var(--bunker-muted)',
                             }} />
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        ) : myVote !== undefined ? (
          /* Вже проголосував */
          <div className="text-center py-3 px-4 rounded-xl"
               style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--bunker-border)' }}>
            <div className="text-2xl mb-1">✅</div>
            <div className="text-xs" style={{ color: 'var(--bunker-muted2)' }}>
              Ви проголосували проти{' '}
              <strong className="text-white">{players[myVote]?.name}</strong>
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--bunker-muted)' }}>Чекаємо інших...</div>
          </div>
        ) : (
          /* Голосуємо */
          <div className="flex flex-col gap-1.5">
            <div className="text-xs mb-1" style={{ color: 'var(--bunker-muted)' }}>
              {isTie ? 'Оберіть кого вигнати з тих що набрали однаково:' : 'Оберіть гравця для виключення:'}
            </div>
            {pendingVote !== null && (
              <div className="text-xs text-center py-1.5 px-3 rounded-lg animate-pulse-urgent"
                   style={{ background: 'rgba(204,34,0,0.1)', color: 'var(--bunker-red)', border: '1px solid rgba(204,34,0,0.25)' }}>
                ☝️ Натисніть ще раз щоб підтвердити
              </div>
            )}
            {alive.map(p => {
              const cnt       = voteCounts[p.id] || 0
              const isPending = pendingVote === p.id
              const baseRed   = isTie ? 'rgba(200,100,0' : 'rgba(204,34,0'
              return (
                <button key={p.id} onClick={() => vote(p.id)}
                        className="flex items-center justify-between py-2.5 px-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                        style={{
                          background: isPending ? `${baseRed},0.28)` : `${baseRed},0.12)`,
                          border: `1px solid ${isPending ? `${baseRed},0.7)` : `${baseRed},0.3)`}`,
                          color: 'white',
                          boxShadow: isPending ? `0 0 12px ${baseRed},0.3)` : 'none',
                          transform: isPending ? 'scale(1.02)' : 'scale(1)',
                          transition: 'all 0.15s ease',
                        }}>
                  <div className="flex items-center gap-1.5">
                    <span>{isPending ? '☠️' : '🚫'} {p.name}</span>
                    {quarantined?.includes(p.id) && (
                      <span className="text-xs px-1 py-px rounded font-bold"
                            style={{ background: 'rgba(80,0,80,0.35)', color: '#cc88ff', fontSize: 9 }}>
                        🏥
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {cnt > 0 && (
                      <span className="text-xs font-normal px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(204,34,0,0.25)', color: '#ff8080' }}>
                        {cnt}
                      </span>
                    )}
                    {isPending && (
                      <span className="text-xs font-black px-2 py-0.5 rounded-full animate-pulse-urgent"
                            style={{ background: 'rgba(204,34,0,0.4)', color: '#ff6060' }}>
                        ПІДТВЕРДИТИ
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Кнопка хоста — підрахувати голоси (тільки без таймера) */}
      {isHost && !timerEnabled && phase === 'voting' && (
        <div className="px-3 pb-3" style={{ background: 'var(--bunker-surface)' }}>
          <button
            onClick={endVoting}
            className="w-full py-2.5 rounded-xl font-black text-sm transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #cc2200, #992000)',
              color: 'white',
              boxShadow: '0 2px 12px rgba(204,34,0,0.3)',
            }}
          >
            ⚡ Підрахувати голоси
          </button>
        </div>
      )}
    </div>
    </div>
  )
}
