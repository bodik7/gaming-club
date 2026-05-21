import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

export function LogPanel() {
  const gameState = useGameStore(s => s.gameState)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [gameState?.log.length])

  if (!gameState?.log.length) return null

  return (
    <div className="rounded-xl flex flex-col overflow-hidden flex-shrink-0"
         style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)', maxHeight: 160 }}>
      <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest flex-shrink-0"
           style={{ color: 'var(--bunker-muted)', borderBottom: '1px solid var(--bunker-border)' }}>
        📋 Хід гри
      </div>
      <div className="overflow-y-auto p-2 flex flex-col-reverse gap-0.5">
        {/* log[0] — найновіший */}
        {gameState.log.map((entry, i) => (
          <div key={i} className="text-xs py-0.5 leading-snug"
               style={{ color: i === 0 ? 'var(--bunker-text)' : 'var(--bunker-muted)', borderLeft: `2px solid ${i === 0 ? 'var(--bunker-red)' : 'var(--bunker-border)'}`, paddingLeft: 6 }}>
            {entry}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
