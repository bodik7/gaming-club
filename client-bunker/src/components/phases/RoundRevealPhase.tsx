import { useGameStore } from '../../store/gameStore'

export function RoundRevealPhase() {
  const { gameState, myIndex } = useGameStore()
  if (!gameState || myIndex === null) return null

  const { round, players } = gameState
  const alivePlayers = players.filter(p => p.isAlive)
  const revealedCount = alivePlayers.filter(p => p.hasRevealed).length
  const total = alivePlayers.length
  const me = players[myIndex]
  const iMustReveal = me?.isAlive && !me?.hasRevealed
  const allAttrsRevealed = me ? Object.values(me.attributes).every(a => a.isRevealed) : false

  return (
    <div className="phase-fixed-panel">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        <div className="px-4 py-3 rounded-xl" style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--bunker-yellow)' }}>
              Раунд {round} · Розкриття
            </span>
            <span className="text-xs font-bold" style={{ color: 'var(--bunker-muted2)' }}>
              {revealedCount} / {total}
            </span>
          </div>

          {/* Прогрес-бар */}
          <div className="rounded-full overflow-hidden mb-3" style={{ height: 4, background: 'var(--bunker-border2)' }}>
            <div className="h-full rounded-full transition-all duration-500"
                 style={{ width: `${total ? (revealedCount / total) * 100 : 0}%`, background: 'var(--bunker-yellow)' }} />
          </div>

          {/* Список гравців */}
          <div className="flex flex-col gap-1">
            {alivePlayers.map(p => (
              <div key={p.id} className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs"
                   style={{ background: p.hasRevealed ? 'rgba(92,184,126,0.06)' : 'rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: 14 }}>{p.hasRevealed ? '✅' : '⏳'}</span>
                <span className="flex-1 truncate font-medium" style={{ color: p.hasRevealed ? 'var(--bunker-green-bright)' : 'var(--bunker-muted2)' }}>
                  {p.name}{p.isBot ? ' 🤖' : ''}
                </span>
                {!p.hasRevealed && (
                  <span style={{ color: 'var(--bunker-muted)', fontSize: 10 }}>чекаємо...</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Підказка для людей — тільки на мобільному */}
        {iMustReveal && (
          <div className="mobile-only px-4 py-2.5 rounded-xl text-xs text-center animate-pulse-urgent"
               style={{ background: 'rgba(224,150,0,0.1)', border: '1px solid rgba(224,150,0,0.3)', color: 'var(--bunker-yellow)' }}>
            {allAttrsRevealed
              ? '👆 Перейди на вкладку «Я» і натисни «Готовий»'
              : '👆 Перейди на вкладку «Я» і натисни на атрибут щоб розкрити'}
          </div>
        )}

      </div>
    </div>
  )
}
