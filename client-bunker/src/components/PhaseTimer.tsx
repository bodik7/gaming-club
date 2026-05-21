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

  const urgent = sec <= 10
  return (
    <div className="text-sm font-black px-3 py-1 rounded-full transition-all"
         style={{
           background: urgent ? 'rgba(204,34,0,0.9)' : 'rgba(0,0,0,0.5)',
           color: urgent ? '#fff' : 'var(--bunker-muted)',
           animation: urgent ? 'pulse 0.6s ease-in-out infinite alternate' : 'none',
         }}>
      ⏱ {sec}с
    </div>
  )
}
