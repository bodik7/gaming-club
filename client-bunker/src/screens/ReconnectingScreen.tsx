import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'

export function ReconnectingScreen() {
  const [timedOut, setTimedOut] = useState(false)
  const setScreen = useGameStore(s => s.setScreen)

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8_000)
    return () => clearTimeout(t)
  }, [])

  const goLobby = () => {
    localStorage.removeItem('monopolia_session')
    setScreen('lobby')
  }

  const retry = () => location.reload()

  if (timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 px-6 text-center"
           style={{ background: '#0b0d0c' }}>
        <div style={{ fontSize: 48 }}>📡</div>
        <div className="text-white font-black text-lg">Не вдалось підключитись</div>
        <div className="text-sm" style={{ color: 'var(--bunker-muted)', maxWidth: 280, lineHeight: 1.6 }}>
          Можливо, сервер перезапустився або зникло інтернет-з'єднання
        </div>
        <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 280, marginTop: 8 }}>
          <button
            onClick={retry}
            className="w-full py-3 rounded-xl font-black text-sm"
            style={{ background: 'var(--bunker-red)', color: 'white' }}>
            🔄 Спробувати знову
          </button>
          <button
            onClick={goLobby}
            className="w-full py-3 rounded-xl font-black text-sm"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--bunker-muted2)', border: '1px solid var(--bunker-border)' }}>
            ← До лобі
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4"
         style={{ background: '#0b0d0c' }}>
      <div style={{ fontSize: 48, animation: 'pulse-urgent 1.2s ease-in-out infinite' }}>⏳</div>
      <div className="text-white font-black text-lg tracking-wide">Відновлення з'єднання...</div>
      <div className="text-sm" style={{ color: 'var(--bunker-muted)' }}>Повертаємося до вашої кімнати</div>
      <button
        onClick={goLobby}
        className="text-xs mt-4 px-4 py-2 rounded-lg"
        style={{ color: 'var(--bunker-muted)', background: 'transparent', border: '1px solid var(--bunker-border)' }}>
        Скасувати
      </button>
    </div>
  )
}
