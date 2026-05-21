import { useEffect } from 'react'
import { useSocket } from './hooks/useSocket'
import { useGameStore } from './store/gameStore'
import { LobbyScreen }   from './screens/LobbyScreen'
import { WaitingScreen } from './screens/WaitingScreen'
import { GameScreen }    from './screens/GameScreen'

export default function App() {
  useSocket() // ініціалізуємо сокет один раз
  const screen = useGameStore(s => s.screen)

  return (
    <div className="min-h-screen flex flex-col">
      {screen === 'lobby'   && <LobbyScreen />}
      {screen === 'waiting' && <WaitingScreen />}
      {screen === 'game'    && <GameScreen />}
    </div>
  )
}
