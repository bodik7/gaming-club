import { useEffect } from 'react'
import { getSocket } from '../hooks/useSocket'
import { useGameStore } from '../store/gameStore'

export function WaitingScreen() {
  const { roomCode, roomPlayers, isHost, myName, reset } = useGameStore()

  useEffect(() => {
    const s = getSocket()

    s.on('lobbyUpdate', ({ players }: { players: string[] }) => {
      useGameStore.getState().setRoomPlayers(players)
    })

    s.on('roomClosed', () => { reset() })
    s.on('kicked',     () => { reset() })

    return () => {
      s.off('lobbyUpdate')
      s.off('roomClosed')
      s.off('kicked')
    }
  }, [])

  const copyCode = () => {
    navigator.clipboard.writeText(`${location.origin}/bunker?join=${roomCode}`)
      .catch(() => {})
  }

  const startGame = () => {
    getSocket().emit('startGame', {})
  }

  const leaveRoom = () => {
    getSocket().emit('leaveRoom')
    reset()
  }

  const minPlayers = 4
  const canStart   = isHost && roomPlayers.length >= minPlayers

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: '#111212' }}>

      <div className="w-full max-w-sm flex flex-col gap-4">

        {/* Код кімнати */}
        <div className="rounded-2xl p-5 text-center"
             style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
          <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--bunker-muted)' }}>
            Код кімнати
          </p>
          <button
            onClick={copyCode}
            className="text-4xl font-black tracking-widest transition-opacity hover:opacity-70 active:scale-95"
            style={{ color: 'var(--bunker-yellow)' }}
            title="Натисніть щоб скопіювати"
          >
            {roomCode}
          </button>
          <p className="text-xs mt-2" style={{ color: 'var(--bunker-muted)' }}>
            Поділіться кодом з іншими гравцями
          </p>
        </div>

        {/* Список гравців */}
        <div className="rounded-2xl p-4"
             style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--bunker-muted)' }}>
              Гравці
            </span>
            <span className="text-xs px-2 py-1 rounded-full"
                  style={{ background: 'rgba(245,196,0,0.15)', color: 'var(--bunker-yellow)' }}>
              {roomPlayers.length} / 15
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {roomPlayers.map((p, i) => (
              <div key={i} className="flex items-center gap-2 py-2 px-3 rounded-lg text-sm"
                   style={{ background: p === myName ? 'rgba(245,196,0,0.08)' : 'transparent',
                            border: p === myName ? '1px solid rgba(245,196,0,0.2)' : '1px solid transparent' }}>
                <span>{i === 0 ? '👑' : '👤'}</span>
                <span style={{ color: p === myName ? 'var(--bunker-yellow)' : 'var(--bunker-text)' }}>
                  {p}{p === myName ? ' (ви)' : ''}
                </span>
              </div>
            ))}
          </div>
          {roomPlayers.length < minPlayers && (
            <p className="text-xs mt-3 text-center" style={{ color: 'var(--bunker-muted)' }}>
              Потрібно ще {minPlayers - roomPlayers.length} гравців для старту
            </p>
          )}
        </div>

        {/* Кнопки */}
        {isHost && (
          <button
            onClick={startGame}
            disabled={!canStart}
            className="w-full py-3 rounded-xl font-black text-sm tracking-wide transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: canStart ? 'var(--bunker-red)' : '#333', color: 'white' }}
          >
            🚀 Почати гру
          </button>
        )}

        {!isHost && (
          <div className="text-center text-sm py-3 rounded-xl"
               style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)',
                        color: 'var(--bunker-muted)' }}>
            Чекаємо поки хост почне гру...
          </div>
        )}

        <button
          onClick={leaveRoom}
          className="w-full py-2 rounded-xl text-sm transition-all hover:opacity-80"
          style={{ background: 'transparent', border: '1px solid rgba(204,34,0,0.4)', color: '#ff6666' }}
        >
          🚪 Вийти з кімнати
        </button>
      </div>
    </div>
  )
}
