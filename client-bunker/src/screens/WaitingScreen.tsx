import { useEffect, useState } from 'react'
import { getSocket } from '../hooks/useSocket'
import { useGameStore } from '../store/gameStore'

const SCENARIOS = [
  { id: 0, emoji: '☢️', title: 'Останній брязкіт прибацаного сусіда',      subtitle: 'Ядерний апокаліпсис' },
  { id: 1, emoji: '🦢', title: 'Помста бойових гусей',                      subtitle: 'Біо-техногенний хаос' },
  { id: 2, emoji: '⚡', title: 'Великий Блекаут та Електро-Монстри',        subtitle: 'Аномальна зима' },
  { id: 3, emoji: '🌊', title: 'Повінь на Говерлі',                         subtitle: 'Ноїв Ковчег' },
  { id: 4, emoji: '🍉', title: 'Повстання Херсонських Кавунів-Убивць',      subtitle: 'Агро-мутація' },
  { id: 5, emoji: '🕶️', title: 'Портал на Троєщині та Потойбічні Гопники', subtitle: 'Містичний злам' },
  { id: 6, emoji: '💅', title: 'Буковельський VIP-Апокаліпсис',             subtitle: 'Гламурні Зомбі' },
  { id: 7, emoji: '☕', title: 'Кавовий Апокаліпсис у Львові',              subtitle: 'Кава-Кома' },
  { id: 8, emoji: '🚜', title: 'Повстання Розумних Комбайнів',              subtitle: 'Кібер-Степ' },
  { id: 9, emoji: '🪼', title: 'Одеський Дрейф та Навала Медуз',            subtitle: 'Біологічна загроза' },
]

const HOW_TO_PLAY = [
  { icon: '🎭', title: 'Персонаж',             text: "Кожен отримує персонажа з 5 прихованими атрибутами: професія, здоров'я, хобі, риса характеру та багаж." },
  { icon: '🔍', title: 'Розкриття',            text: 'Кожен раунд гравці відкривають один свій атрибут. Стратегічно обирайте що показати.' },
  { icon: '💬', title: 'Дискусія і голосування', text: 'Після розкриття — обговорення і голосування. Хто набрав найбільше голосів — вибуває.' },
  { icon: '🃏', title: 'Карти дій',            text: 'Спеціальні карти: підглянути чужий атрибут, обмінятись, заблокувати голос тощо.' },
  { icon: '🏚️', title: 'Мета',                 text: 'Місць у бункері менше ніж гравців. Доведіть свою корисність і потрапте всередину.' },
]

// Стилі — точна копія головного лобі
const S = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: 'radial-gradient(ellipse at 60% 0%, rgba(0,87,183,0.15) 0%, transparent 55%), #0b0d0c',
    fontFamily: "'Segoe UI', sans-serif",
  } as React.CSSProperties,
  wrapper: {
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  } as React.CSSProperties,
  header: { textAlign: 'center', paddingBottom: 4 } as React.CSSProperties,
  logo: { fontSize: 52, lineHeight: 1, marginBottom: 10, filter: 'drop-shadow(0 4px 16px rgba(0,87,183,0.5))' } as React.CSSProperties,
  title: { fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: 1, margin: '0 0 6px', textShadow: '0 2px 12px rgba(0,87,183,0.5)' } as React.CSSProperties,
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', margin: 0 } as React.CSSProperties,
  glass: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 24,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 } as React.CSSProperties,
  // Посилання-запрошення
  linkBox: {
    background: 'rgba(0,87,183,0.12)',
    border: '2px solid rgba(0,87,183,0.35)',
    borderRadius: 14,
    padding: 18,
    textAlign: 'center',
  } as React.CSSProperties,
  linkUrl: { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)', wordBreak: 'break-all', marginBottom: 12, fontFamily: 'monospace' } as React.CSSProperties,
  // Кнопки
  btnPrimary: {
    width: '100%', padding: '14px', fontSize: 15, fontWeight: 700, border: 'none',
    borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
    background: 'linear-gradient(135deg,#ffd700,#ffaa00)', color: '#002a70',
    boxShadow: '0 4px 18px rgba(255,170,0,0.35)',
  } as React.CSSProperties,
  btnPrimaryDisabled: {
    width: '100%', padding: '14px', fontSize: 15, fontWeight: 700, border: 'none',
    borderRadius: 12, cursor: 'not-allowed', opacity: 0.4,
    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
  } as React.CSSProperties,
  btnBlue: {
    width: '100%', padding: '13px', fontSize: 14, fontWeight: 700, border: 'none',
    borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
    background: '#0057b7', color: '#fff', boxShadow: '0 4px 14px rgba(0,87,183,0.3)',
  } as React.CSSProperties,
  btnOutline: {
    width: '100%', padding: '13px', fontSize: 14, fontWeight: 700,
    borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
    background: 'transparent', color: 'rgba(255,255,255,0.8)',
    border: '1.5px solid rgba(255,255,255,0.2)',
  } as React.CSSProperties,
  btnDanger: {
    width: '100%', padding: '13px', fontSize: 14, fontWeight: 700,
    borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
    background: 'transparent', color: 'rgba(239,154,154,0.9)',
    border: '1.5px solid rgba(229,57,53,0.4)',
  } as React.CSSProperties,
  hint: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 } as React.CSSProperties,
  // Лічильник гравців
  badge: {
    fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
    background: 'rgba(0,87,183,0.25)', color: '#60a5fa',
  } as React.CSSProperties,
}

export function WaitingScreen() {
  const { roomCode, roomPlayers, roomBots, isHost, myName, reset, setLeavingToHub, error } = useGameStore()
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null)
  const [timerEnabled, setTimerEnabled]         = useState(true)
  const [showScenarios, setShowScenarios]       = useState(false)
  const [showHowTo, setShowHowTo]               = useState(false)
  const [copied, setCopied]                     = useState(false)

  useEffect(() => {
    const s = getSocket()
    s.on('lobbyUpdate', ({ players, bots }: { players: string[]; bots?: boolean[] }) => {
      useGameStore.getState().setRoomPlayers(players, bots)
    })
    s.on('roomClosed', reset)
    s.on('kicked',     reset)
    return () => { s.off('lobbyUpdate'); s.off('roomClosed'); s.off('kicked') }
  }, [])

  const copyLink = () => {
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

  const startGame = () => getSocket().emit('startGame', {
    settings: {
      ...(selectedScenario !== null && { scenarioId: selectedScenario }),
      timerEnabled,
    },
  })
  const leaveRoom = () => { setLeavingToHub(); getSocket().emit('leaveRoom'); location.replace('/') }

  const minPlayers = 4
  const canStart   = isHost && roomPlayers.length >= minPlayers
  const chosen     = selectedScenario !== null ? SCENARIOS[selectedScenario] : null
  const humanCount = roomPlayers.filter((_, i) => !roomBots[i]).length
  const needMore   = minPlayers - humanCount

  return (
    <div style={S.page}>
      <div style={S.wrapper}>

        {/* Хедер */}
        <div style={S.header}>
          <div style={S.logo}>⏳</div>
          <h1 style={S.title}>Зала очікування</h1>
          <p style={S.sub}>Поділіться посиланням — чекаємо гравців</p>
        </div>

        {/* Скло-картка */}
        <div style={S.glass}>

          {/* Посилання-запрошення */}
          <div style={S.linkBox}>
            <div style={{ ...S.label, marginBottom: 8 }}>📎 Посилання-запрошення</div>
            <div style={S.linkUrl}>{location.origin}?join={roomCode}</div>
            <button style={S.btnBlue} onClick={copyLink}>
              {copied ? '✅ Скопійовано!' : typeof navigator.share === 'function' ? '📤 Поділитись запрошенням' : '📋 Скопіювати посилання'}
            </button>
          </div>

          {/* Гравці */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={S.label}>Гравці в кімнаті</span>
              <span style={S.badge}>{roomPlayers.length}/15</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {roomPlayers.map((p, i) => {
                const isBot = roomBots[i]
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 10, fontSize: 14,
                    background: p === myName ? 'rgba(255,215,0,0.06)' : isBot ? 'rgba(96,165,250,0.05)' : 'rgba(255,255,255,0.03)',
                    color: p === myName ? '#ffd700' : isBot ? '#60a5fa' : 'rgba(255,255,255,0.85)',
                    border: p === myName ? '1px solid rgba(255,215,0,0.15)' : '1px solid transparent',
                  }}>
                    {i === 0 ? '👑' : isBot ? '🤖' : '🎮'} {p}{p === myName ? ' (ви)' : ''}
                  </div>
                )
              })}
            </div>

            {/* Кнопки ботів (тільки хост) */}
            {isHost && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  disabled={roomPlayers.length >= 15}
                  onClick={() => getSocket().emit('addBot')}
                  style={{
                    flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 700, borderRadius: 10,
                    cursor: roomPlayers.length >= 15 ? 'not-allowed' : 'pointer',
                    opacity: roomPlayers.length >= 15 ? 0.35 : 1, transition: 'all 0.2s',
                    background: 'rgba(96,165,250,0.1)', border: '1.5px solid rgba(96,165,250,0.3)', color: '#60a5fa',
                  }}>
                  + Додати бота 🤖
                </button>
                {roomBots.some(Boolean) && (
                  <button onClick={() => getSocket().emit('removeBot')} style={{
                    padding: '9px 16px', fontSize: 13, fontWeight: 700, borderRadius: 10,
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)', color: '#f87171',
                  }}>
                    −
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Вибір сценарію (тільки хост) */}
          {isHost && (
            <div>
              <div style={{ ...S.label, marginBottom: 10 }}>🎬 Сценарій катастрофи</div>
              <button onClick={() => setShowScenarios(v => !v)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.12)',
                transition: 'all 0.2s',
              }}>
                <span style={{ fontSize: 24 }}>{chosen ? chosen.emoji : '🎲'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {chosen ? chosen.title : 'Випадковий сценарій'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    {chosen ? chosen.subtitle : 'Буде обрано автоматично'}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{showScenarios ? '▲' : '▼'}</span>
              </button>
              {showScenarios && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {/* Випадковий — перший */}
                  <button onClick={() => { setSelectedScenario(null); setShowScenarios(false) }} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                    background: selectedScenario === null ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selectedScenario === null ? 'rgba(255,215,0,0.3)' : 'transparent'}`,
                  }}>
                    <span style={{ fontSize: 18 }}>🎲</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Випадковий сценарій</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Буде обрано автоматично</div>
                    </div>
                  </button>
                  {SCENARIOS.map(sc => (
                    <button key={sc.id} onClick={() => { setSelectedScenario(sc.id); setShowScenarios(false) }} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                      background: sc.id === selectedScenario ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${sc.id === selectedScenario ? 'rgba(255,215,0,0.3)' : 'transparent'}`,
                    }}>
                      <span style={{ fontSize: 18 }}>{sc.emoji}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{sc.title}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{sc.subtitle}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Таймер фаз (тільки хост) */}
          {isHost && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14 }}>
              <div style={{ ...S.label, marginBottom: 10 }}>⏱ Таймер фаз</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setTimerEnabled(true)}
                  style={{
                    flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                    background: timerEnabled ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${timerEnabled ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: timerEnabled ? '#ffd700' : 'rgba(255,255,255,0.4)',
                  }}>
                  ⏱ З таймером
                </button>
                <button
                  onClick={() => setTimerEnabled(false)}
                  style={{
                    flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                    background: !timerEnabled ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${!timerEnabled ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: !timerEnabled ? '#60a5fa' : 'rgba(255,255,255,0.4)',
                  }}>
                  ∞ Без таймера
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6, lineHeight: 1.5 }}>
                {timerEnabled
                  ? 'Кожна фаза автоматично завершується по таймеру'
                  : 'Хост або гравці завершують фазу вручну'}
              </div>
            </div>
          )}

          {/* Як грати */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 4 }}>
            <button onClick={() => setShowHowTo(v => !v)} style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', background: 'transparent', border: 'none', cursor: 'pointer',
            }}>
              <span style={{ ...S.label, color: 'rgba(255,215,0,0.6)' }}>📖 Як грати</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{showHowTo ? '▲' : '▼'}</span>
            </button>
            {showHowTo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
                {HOW_TO_PLAY.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{s.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>{/* /glass */}

        {/* Старт / очікування */}
        {isHost ? (
          <button
            onClick={startGame}
            disabled={!canStart}
            style={canStart ? S.btnPrimary : S.btnPrimaryDisabled}
          >
            🚀 Почати гру
          </button>
        ) : (
          <button style={{ ...S.btnOutline, cursor: 'default' }}>
            ⏳ Чекаємо поки хост почне гру...
          </button>
        )}

        <button style={S.btnDanger} onClick={leaveRoom}>
          🚪 Вийти з кімнати
        </button>

        {/* Підказка */}
        <p style={S.hint}>
          {needMore > 0
            ? `Потрібно ще ${needMore} гравців для старту`
            : isHost ? 'Хост бачить кнопку старту' : 'Чекаємо на хоста'}
        </p>

        {error && (
          <div style={{
            borderRadius: 12, padding: '10px 16px', fontSize: 13, textAlign: 'center',
            background: 'rgba(198,40,40,0.15)', border: '1px solid rgba(198,40,40,0.4)', color: '#ef9a9a',
          }}>
            ⚠️ {error}
          </div>
        )}

      </div>
    </div>
  )
}
