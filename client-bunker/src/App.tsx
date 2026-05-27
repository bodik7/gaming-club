import { useEffect } from 'react'
import { useSocket } from './hooks/useSocket'
import { useGameStore } from './store/gameStore'
import { WaitingScreen }      from './screens/WaitingScreen'
import { GameScreen }         from './screens/GameScreen'
import { ReconnectingScreen } from './screens/ReconnectingScreen'

export default function App() {
  useSocket()
  const screen = useGameStore(s => s.screen)

  // Якщо немає сесії — редіректимо на головне лобі
  useEffect(() => {
    if (screen === 'lobby') {
      location.replace('/')
    }
  }, [screen])

  return (
    <div className="min-h-screen flex flex-col">
      {screen === 'reconnecting' && <ReconnectingScreen />}
      {screen === 'waiting'      && <WaitingScreen />}
      {screen === 'game'         && <GameScreen />}
    </div>
  )
}
