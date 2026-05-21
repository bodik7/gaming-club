import { useEffect, useState } from 'react'
import { getSocket } from '../hooks/useSocket'
import { useGameStore } from '../store/gameStore'

// Список сценаріїв — дзеркало scenarios.js
const SCENARIOS = [
  { id: 0, emoji: '☢️', title: 'Останній брязкіт прибацаного сусіда',   subtitle: 'Ядерний апокаліпсис' },
  { id: 1, emoji: '🦢', title: 'Помста бойових гусей',                   subtitle: 'Біо-техногенний хаос' },
  { id: 2, emoji: '⚡', title: 'Великий Блекаут та Електро-Монстри',     subtitle: 'Аномальна зима' },
  { id: 3, emoji: '🌊', title: 'Повінь на Говерлі',                      subtitle: 'Ноїв Ковчег' },
  { id: 4, emoji: '🍉', title: 'Повстання Херсонських Кавунів-Убивць',   subtitle: 'Агро-мутація' },
  { id: 5, emoji: '🕶️', title: 'Портал на Троєщині та Потойбічні Гопники', subtitle: 'Містичний злам' },
  { id: 6, emoji: '💅', title: 'Буковельський VIP-Апокаліпсис',          subtitle: 'Гламурні Зомбі' },
  { id: 7, emoji: '☕', title: 'Кавовий Апокаліпсис у Львові',            subtitle: 'Кава-Кома' },
  { id: 8, emoji: '🚜', title: 'Повстання Розумних Комбайнів',            subtitle: 'Кібер-Степ' },
  { id: 9, emoji: '🪼', title: 'Одеський Дрейф та Навала Медуз',         subtitle: 'Біологічна загроза' },
]

export function WaitingScreen() {
  const { roomCode, roomPlayers, isHost, myName, reset } = useGameStore()
  const [selectedScenario, setSelectedScenario] = useState<number>(0)
  const [showScenarios, setShowScenarios] = useState(false)

  useEffect(() => {
    const s = getSocket()
    s.on('lobbyUpdate', ({ players }: { players: string[] }) => {
      useGameStore.getState().setRoomPlayers(players)
    })
    s.on('roomClosed', reset)
    s.on('kicked',     reset)
    return () => { s.off('lobbyUpdate'); s.off('roomClosed'); s.off('kicked') }
  }, [])

  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    const url = `${location.origin}?join=${roomCode}`
    if (navigator.share) {
      navigator.share({ title: 'Бункер — запрошення', url }).catch(() => {})
      return
    }
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => {})
  }

  const startGame = () => {
    getSocket().emit('startGame', { scenarioId: selectedScenario })
  }

  const leaveRoom = () => {
    getSocket().emit('leaveRoom')
    reset()
  }

  const minPlayers = 4
  const canStart   = isHost && roomPlayers.length >= minPlayers
  const chosen     = SCENARIOS[selectedScenario]

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#111212' }}>
      <div className="w-full max-w-sm flex flex-col gap-3">

        {/* Посилання-запрошення */}
        <div className="rounded-2xl p-4"
             style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
          <p className="text-xs uppercase tracking-widest mb-2 text-center" style={{ color: 'var(--bunker-muted)' }}>
            📎 Посилання-запрошення
          </p>
          <p className="text-xs text-center mb-3 break-all font-mono"
             style={{ color: 'rgba(255,255,255,0.6)' }}>
            {location.origin}?join={roomCode}
          </p>
          <button onClick={copyCode}
                  className="w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: 'var(--bunker-blue, #0057b7)', color: 'white' }}>
            {copied ? '✅ Скопійовано!' : '📋 Скопіювати посилання'}
          </button>
        </div>

        {/* Гравці */}
        <div className="rounded-2xl p-4"
             style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--bunker-muted)' }}>
              Гравці
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,196,0,0.15)', color: 'var(--bunker-yellow)' }}>
              {roomPlayers.length} / 15
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {roomPlayers.map((p, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm"
                   style={{
                     background: p === myName ? 'rgba(245,196,0,0.06)' : 'transparent',
                     color: p === myName ? 'var(--bunker-yellow)' : 'var(--bunker-text)',
                   }}>
                {i === 0 ? '👑' : '👤'} {p}{p === myName ? ' (ви)' : ''}
              </div>
            ))}
          </div>
          {roomPlayers.length < minPlayers && (
            <p className="text-xs mt-2 text-center" style={{ color: 'var(--bunker-muted)' }}>
              Потрібно ще {minPlayers - roomPlayers.length} гравців
            </p>
          )}
        </div>

        {/* Вибір сценарію (тільки хост) */}
        {isHost && (
          <div className="rounded-2xl p-4 flex flex-col gap-2"
               style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--bunker-muted)' }}>
              🎬 Сценарій
            </div>

            {/* Обраний */}
            <button
              onClick={() => setShowScenarios(v => !v)}
              className="flex items-center gap-3 py-2 px-3 rounded-xl text-left transition-all"
              style={{ background: 'rgba(204,34,0,0.12)', border: '1px solid rgba(204,34,0,0.3)' }}
            >
              <span className="text-2xl">{chosen.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white truncate">{chosen.title}</div>
                <div className="text-xs" style={{ color: 'var(--bunker-muted)' }}>{chosen.subtitle}</div>
              </div>
              <span className="text-xs" style={{ color: 'var(--bunker-muted)' }}>{showScenarios ? '▲' : '▼'}</span>
            </button>

            {/* Список */}
            {showScenarios && (
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                {SCENARIOS.map(sc => (
                  <button
                    key={sc.id}
                    onClick={() => { setSelectedScenario(sc.id); setShowScenarios(false) }}
                    className="flex items-center gap-2 py-1.5 px-3 rounded-lg text-left transition-all text-xs"
                    style={{
                      background: sc.id === selectedScenario ? 'rgba(204,34,0,0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${sc.id === selectedScenario ? 'rgba(204,34,0,0.4)' : 'transparent'}`,
                      color: 'white',
                    }}
                  >
                    <span>{sc.emoji}</span>
                    <div>
                      <div className="font-bold">{sc.title}</div>
                      <div style={{ color: 'var(--bunker-muted)' }}>{sc.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Кнопки */}
        {isHost ? (
          <button onClick={startGame} disabled={!canStart}
                  className="w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95 disabled:opacity-40"
                  style={{ background: canStart ? 'var(--bunker-red)' : '#333', color: 'white' }}>
            🚀 Почати гру
          </button>
        ) : (
          <div className="text-center text-sm py-3 rounded-xl"
               style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)', color: 'var(--bunker-muted)' }}>
            Чекаємо поки хост почне гру...
          </div>
        )}

        <button onClick={leaveRoom}
                className="w-full py-2 rounded-xl text-sm"
                style={{ border: '1px solid rgba(204,34,0,0.3)', color: '#ff6666' }}>
          🚪 Вийти з кімнати
        </button>
      </div>
    </div>
  )
}
