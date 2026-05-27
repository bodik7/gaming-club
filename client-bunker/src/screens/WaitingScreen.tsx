import { useEffect, useRef, useState } from 'react'
import { getSocket } from '../hooks/useSocket'
import { useGameStore } from '../store/gameStore'

// ── Сценарії ──────────────────────────────────────────────────────────────────
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

// ── Як грати ──────────────────────────────────────────────────────────────────
const HOW_TO_PLAY = [
  { icon: '🎭', title: 'Персонаж',               text: "Кожен отримує персонажа з 5 прихованими атрибутами: професія, здоров'я, хобі, риса характеру та багаж." },
  { icon: '🔍', title: 'Розкриття',              text: 'Кожен раунд гравці відкривають один свій атрибут. Стратегічно обирайте що показати.' },
  { icon: '💬', title: 'Дискусія і голосування', text: 'Після розкриття — обговорення і голосування. Хто набрав найбільше голосів — вибуває.' },
  { icon: '🃏', title: 'Карти дій',              text: 'Спеціальні карти: підглянути чужий атрибут, обмінятись, заблокувати голос тощо.' },
  { icon: '🏚️', title: 'Мета',                   text: 'Місць у бункері менше ніж гравців. Доведіть свою корисність і потрапте всередину.' },
]

// ── Допоміжні компоненти ──────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bunker-surface)',
      border: '1px solid var(--bunker-border)',
      borderRadius: 16,
      padding: '18px 20px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
      textTransform: 'uppercase', color: 'var(--bunker-muted)',
      marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

// ── Основний компонент ────────────────────────────────────────────────────────

export function WaitingScreen() {
  const { roomCode, roomPlayers, roomBots, isHost, myName, reset, setLeavingToHub, error } = useGameStore()

  const [selectedScenario, setSelectedScenario] = useState<number | null>(null)
  const [timerEnabled, setTimerEnabled]         = useState(true)
  const [showScenarios, setShowScenarios]       = useState(false)
  const [showHowTo, setShowHowTo]               = useState(false)
  const [copied, setCopied]                     = useState(false)
  const scenarioRef = useRef<HTMLDivElement>(null)

  // Закриваємо дропдаун при кліку поза ним
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (scenarioRef.current && !scenarioRef.current.contains(e.target as Node))
        setShowScenarios(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  const startGame = () =>
    getSocket().emit('startGame', {
      settings: {
        ...(selectedScenario !== null && { scenarioId: selectedScenario }),
        timerEnabled,
      },
    })

  const leaveRoom = () => {
    setLeavingToHub()
    getSocket().emit('leaveRoom')
    location.replace('/')
  }

  const chosen     = selectedScenario !== null ? SCENARIOS[selectedScenario] : null
  const humanCount = roomPlayers.filter((_, i) => !roomBots[i]).length
  const needMore   = Math.max(0, 4 - humanCount)
  const canStart   = isHost && roomPlayers.length >= 4

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'radial-gradient(ellipse at 30% 20%, rgba(100,20,0,0.35) 0%, transparent 55%), radial-gradient(ellipse at 75% 85%, rgba(180,90,0,0.12) 0%, transparent 50%), var(--bunker-bg)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '28px 16px 40px',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Хедер ── */}
        <div style={{ textAlign: 'center', paddingBottom: 4 }}>
          <div className="hazard-stripe" style={{ margin: '0 auto 14px', width: 80, borderRadius: 3, opacity: 0.7 }} />
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 10, filter: 'drop-shadow(0 4px 18px rgba(204,34,0,0.4))' }}>🏚️</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: 1, margin: '0 0 4px', textShadow: '0 2px 14px rgba(204,34,0,0.35)' }}>
            Зала очікування
          </h1>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--bunker-muted2)' }}>Код кімнати:</span>
            <span style={{
              fontFamily: 'monospace', fontSize: 16, fontWeight: 900, letterSpacing: 3,
              color: 'var(--bunker-yellow)', padding: '2px 10px', borderRadius: 8,
              background: 'rgba(224,150,0,0.1)', border: '1px solid rgba(224,150,0,0.25)',
            }}>
              {roomCode}
            </span>
          </div>
        </div>

        {/* ── Запрошення ── */}
        <Card>
          <SectionLabel>📎 Запросити гравців</SectionLabel>
          <div style={{
            fontFamily: 'monospace', fontSize: 12, color: 'var(--bunker-muted2)',
            background: 'var(--bunker-surface2)', borderRadius: 8, padding: '8px 12px',
            marginBottom: 10, wordBreak: 'break-all', lineHeight: 1.5,
          }}>
            {location.origin}?join={roomCode}
          </div>
          <button
            onClick={copyLink}
            style={{
              width: '100%', padding: '11px', fontSize: 14, fontWeight: 700,
              borderRadius: 10, cursor: 'pointer', border: 'none',
              background: copied ? 'rgba(92,184,126,0.15)' : '#0057b7',
              color: copied ? 'var(--bunker-green-bright)' : '#fff',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => !copied && (e.currentTarget.style.filter = 'brightness(1.15)')}
            onMouseLeave={e => (e.currentTarget.style.filter = '')}
          >
            {copied ? '✅ Скопійовано!' : typeof navigator.share === 'function' ? '📤 Поділитись запрошенням' : '📋 Скопіювати посилання'}
          </button>
        </Card>

        {/* ── Гравці ── */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <SectionLabel>🎮 Гравці в кімнаті</SectionLabel>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 20,
              background: 'rgba(204,34,0,0.12)', color: 'var(--bunker-red)', border: '1px solid rgba(204,34,0,0.2)',
            }}>
              {roomPlayers.length} / 15
            </span>
          </div>

          {/* Список гравців */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: isHost ? 12 : 0 }}>
            {roomPlayers.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--bunker-muted)', fontSize: 13, padding: '10px 0' }}>
                Ніхто ще не приєднався...
              </div>
            ) : roomPlayers.map((p, i) => {
              const isBot  = roomBots[i]
              const isMe   = p === myName
              const isFirst = i === 0
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 10, fontSize: 13,
                  background: isMe
                    ? 'rgba(224,150,0,0.07)'
                    : isBot
                    ? 'rgba(58,122,90,0.06)'
                    : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isMe ? 'rgba(224,150,0,0.2)' : 'transparent'}`,
                  color: isMe ? 'var(--bunker-yellow)' : isBot ? 'var(--bunker-green-bright)' : 'var(--bunker-text)',
                  transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>
                    {isFirst ? '👑' : isBot ? '🤖' : '🎮'}
                  </span>
                  <span style={{ flex: 1, fontWeight: isMe ? 700 : 500 }}>
                    {p}{isMe ? ' (ви)' : ''}
                  </span>
                  {isFirst && !isMe && (
                    <span style={{ fontSize: 10, color: 'var(--bunker-muted)', fontWeight: 700 }}>ХОСТ</span>
                  )}
                  {isBot && (
                    <span style={{ fontSize: 10, color: 'var(--bunker-muted)', fontWeight: 700 }}>БОТ</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Кнопки ботів — тільки хост */}
          {isHost && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={roomPlayers.length >= 15}
                onClick={() => getSocket().emit('addBot')}
                style={{
                  flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 700,
                  borderRadius: 10, cursor: roomPlayers.length >= 15 ? 'not-allowed' : 'pointer',
                  opacity: roomPlayers.length >= 15 ? 0.3 : 1, transition: 'all 0.15s',
                  background: 'rgba(58,122,90,0.1)',
                  border: '1.5px solid rgba(58,122,90,0.35)',
                  color: 'var(--bunker-green-bright)',
                }}
                onMouseEnter={e => { if (roomPlayers.length < 15) e.currentTarget.style.background = 'rgba(58,122,90,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(58,122,90,0.1)' }}
              >
                + Додати бота 🤖
              </button>
              {roomBots.some(Boolean) && (
                <button
                  onClick={() => getSocket().emit('removeBot')}
                  style={{
                    padding: '9px 16px', fontSize: 13, fontWeight: 700,
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                    background: 'rgba(204,34,0,0.08)',
                    border: '1.5px solid rgba(204,34,0,0.3)',
                    color: '#ef9a9a',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(204,34,0,0.18)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(204,34,0,0.08)' }}
                >
                  − Прибрати
                </button>
              )}
            </div>
          )}
        </Card>

        {/* ── Налаштування (тільки хост) ── */}
        {isHost && (
          <Card>
            <SectionLabel>⚙️ Налаштування гри</SectionLabel>

            {/* Сценарій */}
            <div ref={scenarioRef} style={{ marginBottom: 16, position: 'relative' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bunker-muted2)', marginBottom: 6 }}>
                🎬 Сценарій катастрофи
              </div>
              <button
                onClick={() => setShowScenarios(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                  background: 'var(--bunker-surface2)',
                  border: `1.5px solid ${showScenarios ? 'rgba(224,150,0,0.4)' : 'var(--bunker-border)'}`,
                  transition: 'all 0.15s', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>{chosen ? chosen.emoji : '🎲'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {chosen ? chosen.title : 'Випадковий сценарій'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--bunker-muted)', marginTop: 1 }}>
                    {chosen ? chosen.subtitle : 'Буде обрано автоматично'}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--bunker-muted)', flexShrink: 0 }}>
                  {showScenarios ? '▲' : '▼'}
                </span>
              </button>

              {showScenarios && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  marginTop: 4, borderRadius: 12, overflow: 'hidden',
                  border: '1px solid var(--bunker-border)',
                  background: '#0f1312',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  maxHeight: 280, overflowY: 'auto',
                }}>
                  {/* Випадковий */}
                  <button
                    onClick={() => { setSelectedScenario(null); setShowScenarios(false) }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', textAlign: 'left', cursor: 'pointer', border: 'none',
                      background: selectedScenario === null ? 'rgba(224,150,0,0.08)' : 'transparent',
                      borderBottom: '1px solid var(--bunker-border)', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (selectedScenario !== null) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={e => { if (selectedScenario !== null) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 18 }}>🎲</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: selectedScenario === null ? 'var(--bunker-yellow)' : '#fff' }}>
                        Випадковий сценарій
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--bunker-muted)' }}>Буде обрано автоматично</div>
                    </div>
                    {selectedScenario === null && <span style={{ marginLeft: 'auto', color: 'var(--bunker-yellow)', fontSize: 12 }}>✓</span>}
                  </button>

                  {SCENARIOS.map(sc => (
                    <button
                      key={sc.id}
                      onClick={() => { setSelectedScenario(sc.id); setShowScenarios(false) }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', textAlign: 'left', cursor: 'pointer', border: 'none',
                        background: sc.id === selectedScenario ? 'rgba(224,150,0,0.08)' : 'transparent',
                        borderBottom: '1px solid var(--bunker-border)', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (sc.id !== selectedScenario) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (sc.id !== selectedScenario) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ fontSize: 18 }}>{sc.emoji}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: sc.id === selectedScenario ? 'var(--bunker-yellow)' : '#fff' }}>
                          {sc.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--bunker-muted)' }}>{sc.subtitle}</div>
                      </div>
                      {sc.id === selectedScenario && <span style={{ marginLeft: 'auto', color: 'var(--bunker-yellow)', fontSize: 12 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Таймер */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bunker-muted2)', marginBottom: 8 }}>
                ⏱ Таймер фаз
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setTimerEnabled(true)}
                  style={{
                    flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700,
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                    background: timerEnabled ? 'rgba(224,150,0,0.12)' : 'var(--bunker-surface2)',
                    outline: timerEnabled ? '1.5px solid rgba(224,150,0,0.4)' : '1.5px solid var(--bunker-border)',
                    color: timerEnabled ? 'var(--bunker-yellow)' : 'var(--bunker-muted)',
                  }}
                >
                  ⏱ З таймером
                </button>
                <button
                  onClick={() => setTimerEnabled(false)}
                  style={{
                    flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700,
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                    background: !timerEnabled ? 'rgba(58,122,90,0.1)' : 'var(--bunker-surface2)',
                    outline: !timerEnabled ? '1.5px solid rgba(58,122,90,0.4)' : '1.5px solid var(--bunker-border)',
                    color: !timerEnabled ? 'var(--bunker-green-bright)' : 'var(--bunker-muted)',
                  }}
                >
                  ∞ Без таймера
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--bunker-muted)', marginTop: 6, lineHeight: 1.5 }}>
                {timerEnabled
                  ? 'Кожна фаза автоматично завершується по таймеру'
                  : 'Хост або гравці завершують фазу вручну'}
              </div>
            </div>
          </Card>
        )}

        {/* ── Як грати ── */}
        <Card style={{ padding: '14px 20px' }}>
          <button
            onClick={() => setShowHowTo(v => !v)}
            style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(224,150,0,0.7)' }}>
              📖 Як грати
            </span>
            <span style={{ fontSize: 11, color: 'var(--bunker-muted)' }}>{showHowTo ? '▲' : '▼'}</span>
          </button>

          {showHowTo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }} className="animate-fade-up">
              {HOW_TO_PLAY.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--bunker-muted2)', lineHeight: 1.6 }}>{s.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Кнопки дій ── */}
        {isHost ? (
          <button
            onClick={startGame}
            disabled={!canStart}
            style={{
              width: '100%', padding: '15px', fontSize: 16, fontWeight: 900,
              borderRadius: 12, cursor: canStart ? 'pointer' : 'not-allowed',
              border: 'none', transition: 'all 0.2s',
              background: canStart
                ? 'linear-gradient(135deg, var(--bunker-red), #aa1a00)'
                : 'rgba(255,255,255,0.06)',
              color: canStart ? '#fff' : 'rgba(255,255,255,0.3)',
              boxShadow: canStart ? '0 4px 20px rgba(204,34,0,0.4)' : 'none',
              opacity: canStart ? 1 : 0.6,
            }}
            onMouseEnter={e => { if (canStart) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.filter = '' }}
          >
            {canStart ? '🚀 Почати гру' : `⏳ Потрібно ще ${needMore} гравців`}
          </button>
        ) : (
          <div style={{
            width: '100%', padding: '15px', fontSize: 14, fontWeight: 700,
            borderRadius: 12, textAlign: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1.5px solid var(--bunker-border)',
            color: 'var(--bunker-muted2)',
          }}>
            ⏳ Чекаємо поки хост почне гру...
          </div>
        )}

        <button
          onClick={leaveRoom}
          style={{
            width: '100%', padding: '12px', fontSize: 14, fontWeight: 700,
            borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
            background: 'transparent', color: 'rgba(239,154,154,0.7)',
            border: '1.5px solid rgba(229,57,53,0.2)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(204,34,0,0.08)'
            e.currentTarget.style.borderColor = 'rgba(229,57,53,0.45)'
            e.currentTarget.style.color = '#ef9a9a'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'rgba(229,57,53,0.2)'
            e.currentTarget.style.color = 'rgba(239,154,154,0.7)'
          }}
        >
          🚪 Вийти з кімнати
        </button>

        {/* Підказка */}
        {!isHost && needMore > 0 && (
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--bunker-muted)', margin: 0 }}>
            Потрібно ще {needMore} гравців для старту
          </p>
        )}

        {/* Помилка */}
        {error && (
          <div style={{
            borderRadius: 12, padding: '10px 16px', fontSize: 13, textAlign: 'center',
            background: 'rgba(198,40,40,0.12)', border: '1px solid rgba(198,40,40,0.35)', color: '#ef9a9a',
          }} className="animate-fade-up">
            ⚠️ {error}
          </div>
        )}

      </div>
    </div>
  )
}
