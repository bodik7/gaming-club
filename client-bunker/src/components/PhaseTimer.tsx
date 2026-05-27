import { useEffect, useState } from 'react'

export function PhaseTimer({ deadline }: { deadline: number | null }) {
  const [sec, setSec] = useState<number | null>(null)

  useEffect(() => {
    if (!deadline) { setSec(null); return }
    const tick = () => setSec(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [deadline])

  if (sec === null) return null

  const urgent  = sec <= 10
  const critical = sec <= 5
  const minutes = Math.floor(sec / 60)
  const secs    = sec % 60
  const display = minutes > 0
    ? `${minutes}:${String(secs).padStart(2, '0')}`
    : `${sec}с`

  return (
    <div
      className="text-sm font-black px-3 py-1 rounded-lg flex items-center gap-1.5 flex-shrink-0"
      style={{
        background: critical ? 'rgba(204,34,0,0.95)' : urgent ? 'rgba(204,34,0,0.85)' : 'rgba(0,0,0,0.4)',
        color:      urgent ? '#fff' : 'var(--bunker-muted2)',
        border:     `1px solid ${critical ? '#ff4422' : urgent ? 'rgba(204,34,0,0.6)' : 'var(--bunker-border)'}`,
        animation:  critical ? 'pulse-urgent 0.4s ease-in-out infinite' : urgent ? 'pulse-urgent 0.65s ease-in-out infinite' : 'none',
        filter:     critical ? 'drop-shadow(0 0 12px rgba(204,34,0,0.9))' : urgent ? 'drop-shadow(0 0 8px rgba(204,34,0,0.7))' : 'none',
        minWidth:   52,
        textAlign:  'center',
        fontVariantNumeric: 'tabular-nums',
        transition: 'filter 0.4s ease, background 0.3s ease',
      }}
    >
      {urgent ? '⚠️' : '⏱'}
      {/* key заставляє span перемонтуватись і анімуватись при кожній зміні секунди */}
      <span
        key={sec}
        style={{ animation: urgent ? 'tick-bounce 0.22s ease-out' : 'none', display: 'inline-block' }}
      >
        {display}
      </span>
    </div>
  )
}
