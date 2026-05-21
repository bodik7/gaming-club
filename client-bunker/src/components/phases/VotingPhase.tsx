import { useState } from 'react'
import { getSocket } from '../../hooks/useSocket'
import { useGameStore } from '../../store/gameStore'

export function VotingPhase() {
  const { gameState, myIndex } = useGameStore()
  const [voted, setVoted] = useState(false)
  if (!gameState || myIndex === null) return null

  const { players, votes, phase } = gameState
  const alive = players.filter(p => p.isAlive && p.id !== myIndex)
  const myVote = votes[myIndex]

  const vote = (targetIdx: number) => {
    if (voted || myVote !== undefined) return
    getSocket().emit('action', { type: 'b_vote', data: { target: targetIdx } })
    setVoted(true)
  }

  // Підрахунок голосів для відображення
  const voteCounts: Record<number, number> = {}
  Object.values(votes).forEach(t => { voteCounts[t] = (voteCounts[t] || 0) + 1 })

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3"
         style={{ background: 'rgba(204,34,0,0.08)', border: '1px solid rgba(204,34,0,0.3)' }}>
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--bunker-red)' }}>
        🗳️ Голосування
      </div>

      {phase === 'voting_result' ? (
        <div className="flex flex-col gap-2">
          {players.filter(p => p.isAlive).map(p => (
            <div key={p.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg text-sm"
                 style={{ background: 'rgba(255,255,255,0.04)' }}>
              <span className="text-white">{p.name}</span>
              <span className="font-bold" style={{ color: (voteCounts[p.id] || 0) > 0 ? 'var(--bunker-red)' : 'var(--bunker-muted)' }}>
                {voteCounts[p.id] || 0} голосів
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {myVote !== undefined ? (
            <div className="text-xs text-center py-2" style={{ color: 'var(--bunker-muted)' }}>
              ✅ Ви проголосували проти <strong className="text-white">{players[myVote]?.name}</strong>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-xs" style={{ color: 'var(--bunker-muted)' }}>
                Хто має залишити бункер?
              </div>
              {alive.map(p => (
                <button key={p.id} onClick={() => vote(p.id)}
                        className="text-left py-2 px-3 rounded-lg text-sm font-bold transition-all active:scale-95 hover:opacity-80"
                        style={{ background: 'rgba(204,34,0,0.2)', color: 'white',
                                 border: '1px solid rgba(204,34,0,0.4)' }}>
                  🚫 {p.name}
                  {voteCounts[p.id] ? (
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--bunker-muted)' }}>
                      ({voteCounts[p.id]} голос)
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
