import { useState } from 'react'
import { getSocket } from '../../hooks/useSocket'
import { useGameStore } from '../../store/gameStore'

export function VotingPhase() {
  const { gameState, myIndex } = useGameStore()
  const [voted, setVoted] = useState(false)
  if (!gameState || myIndex === null) return null

  const { players, votes, phase } = gameState
  const alive   = players.filter(p => p.isAlive && p.id !== myIndex)
  const myVote  = votes[myIndex]

  const vote = (targetIdx: number) => {
    if (voted || myVote !== undefined) return
    getSocket().emit('action', { type: 'b_vote', data: { target: targetIdx } })
    setVoted(true)
  }

  const voteCounts: Record<number, number> = {}
  Object.values(votes).forEach(t => { voteCounts[t] = (voteCounts[t] || 0) + 1 })

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0)
  const maxVotes   = Math.max(0, ...Object.values(voteCounts))

  return (
    <div className="rounded-xl overflow-hidden animate-fade-up"
         style={{ border: '1px solid rgba(204,34,0,0.35)', boxShadow: '0 0 16px rgba(204,34,0,0.06)' }}>

      {/* Заголовок */}
      <div className="px-4 py-2 text-xs font-black uppercase tracking-widest"
           style={{ background: 'rgba(204,34,0,0.15)', color: 'var(--bunker-red)' }}>
        🗳️ Голосування — хто залишає бункер?
      </div>

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
                      <span className="text-sm font-bold text-white">{p.name}</span>
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
              Оберіть гравця для виключення:
            </div>
            {alive.map(p => {
              const cnt = voteCounts[p.id] || 0
              return (
                <button key={p.id} onClick={() => vote(p.id)}
                        className="flex items-center justify-between py-2.5 px-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                        style={{
                          background: 'rgba(204,34,0,0.12)',
                          border: '1px solid rgba(204,34,0,0.3)',
                          color: 'white',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(204,34,0,0.22)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(204,34,0,0.12)')}>
                  <span>🚫 {p.name}</span>
                  {cnt > 0 && (
                    <span className="text-xs font-normal px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(204,34,0,0.25)', color: '#ff8080' }}>
                      {cnt}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
