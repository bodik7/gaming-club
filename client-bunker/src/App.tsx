import { useEffect, useState } from 'react'
import { useSocket } from './hooks/useSocket'
import { useGameStore } from './store/gameStore'
import { WaitingScreen }      from './screens/WaitingScreen'
import { GameScreen }         from './screens/GameScreen'
import { ReconnectingScreen } from './screens/ReconnectingScreen'

function HubRedirectLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
         style={{ background: 'var(--bunker-bg)' }}>
      <div style={{ fontSize: 40, animation: 'spin 1s linear infinite' }}>⏳</div>
      <div style={{ color: 'var(--bunker-muted2)', fontSize: 14, fontWeight: 600 }}>
        Повертаємось до лобі…
      </div>
    </div>
  )
}

export default function App() {
  useSocket()
  const screen = useGameStore(s => s.screen)
  const [leaving, setLeaving] = useState(false)

  // Якщо немає сесії — редіректимо на головне лобі
  useEffect(() => {
    if (screen === 'lobby') {
      setLeaving(true)
      const t = setTimeout(() => location.replace('/'), 300)
      return () => clearTimeout(t)
    }
  }, [screen])

  if (leaving) return <HubRedirectLoader />

  return (
    <div className="min-h-screen flex flex-col">
      {screen === 'reconnecting' && <ReconnectingScreen />}
      {screen === 'waiting'      && <WaitingScreen />}
      {screen === 'game'         && <GameScreen />}
    </div>
  )
}
