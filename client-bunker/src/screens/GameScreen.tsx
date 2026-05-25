import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { AnimatePresence, motion } from 'framer-motion'
import { GameStartPhase }    from '../components/phases/GameStartPhase'
import { RoundRevealPhase }  from '../components/phases/RoundRevealPhase'
import { DiscussionPhase }   from '../components/phases/DiscussionPhase'
import { VotingPhase }       from '../components/phases/VotingPhase'
import { EndGamePhase }      from '../components/phases/EndGamePhase'
import { PlayerGrid }        from '../components/PlayerGrid'
import { PhaseTimer }        from '../components/PhaseTimer'
import { ChatPanel }         from '../components/ChatPanel'
import { LogPanel }          from '../components/LogPanel'
import { ActionCardPanel }   from '../components/ActionCardPanel'
import { getSocket }         from '../hooks/useSocket'

const ATTR_LABELS: Record<string, string> = {
  profession: '💼 Професія',
  biology:    '🧬 Біологія',
  health:     '❤️ Здоров\'я',
  hobby:      '🎯 Хобі',
  trait:      '🧠 Риса',
  baggage:    '🎒 Багаж',
}

const ATTR_COLORS: Record<string, string> = {
  profession: '#e09600',
  biology:    '#5cb87e',
  health:     '#cc5555',
  hobby:      '#6088cc',
  trait:      '#aa88cc',
  baggage:    '#cc8844',
}

const PHASE_META: Record<string, { label: string; color: string; bg: string }> = {
  game_start:     { label: 'СТАРТ',        color: '#6088cc', bg: 'rgba(60,100,200,0.18)' },
  round_reveal:   { label: 'РОЗКРИТТЯ',    color: '#e09600', bg: 'rgba(224,150,0,0.15)'  },
  discussion:     { label: 'ОБГОВОРЕННЯ',  color: '#5cb87e', bg: 'rgba(60,150,100,0.15)' },
  voting:         { label: 'ГОЛОСУВАННЯ',  color: '#cc2200', bg: 'rgba(204,34,0,0.18)'   },
  voting_result:  { label: 'РЕЗУЛЬТАТ',    color: '#cc7700', bg: 'rgba(200,100,0,0.15)'  },
  end_game:       { label: 'ФІНАЛ',        color: '#8a9290', bg: 'rgba(100,120,120,0.15)'},
}

type MobileTab = 'players' | 'chat' | 'me' | 'scenario'

export function GameScreen() {
  const { gameState, myIndex, setLeavingToHub } = useGameStore()
  const chatCount = useGameStore(s => s.chat.length)
  const [mobileTab, setMobileTab]       = useState<MobileTab>('players')
  const [lastSeenChat, setLastSeenChat] = useState(0)
  const playersScrollRef = useRef<HTMLDivElement>(null)

  if (!gameState) return null

  const { phase, scenario, bunkerCapacity, players } = gameState
  const alive = players.filter(p => p.isAlive).length
  const me    = myIndex !== null ? players[myIndex] : null
  const pm    = PHASE_META[phase] || PHASE_META['game_start']

  const unreadChat = mobileTab !== 'chat' ? Math.max(0, chatCount - lastSeenChat) : 0

  // Авто-переключення вкладок при зміні фази
  useEffect(() => {
    if (phase === 'game_start') {
      setMobileTab('scenario') // Читаємо сценарій перед стартом
    } else if (phase === 'round_reveal') {
      setMobileTab('players')
      // Скролимо вниз — кнопка розкриття внизу списку гравців
      setTimeout(() => {
        const el = playersScrollRef.current
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      }, 80)
    } else if (phase === 'voting' || phase === 'end_game') {
      setMobileTab('players')
      setTimeout(() => playersScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 60)
    }
  }, [phase])

  const switchTab = (tab: MobileTab) => {
    setMobileTab(tab)
    if (tab === 'chat') setLastSeenChat(chatCount)
  }

  const leaveGame = () => {
    const otherHumans = players.filter((p, i) => i !== myIndex && !p.isBot)
    const hasHumans   = otherHumans.length > 0
    const msg = hasHumans
      ? 'Покинути гру?\n\nВаш стан збережеться — ви зможете повернутись через це ж посилання.'
      : 'Покинути гру? Кімната закриється.'
    if (!confirm(msg)) return
    if (!hasHumans) localStorage.removeItem('monopolia_session')
    setLeavingToHub()
    getSocket().emit('leaveRoom')
    location.replace('/')
  }

  // Вміст поточної фази — використовується в обох лейаутах
  const phaseContent = (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {phase === 'game_start'   && <GameStartPhase />}
        {phase === 'round_reveal' && <RoundRevealPhase />}
        {phase === 'discussion'   && <DiscussionPhase />}
        {(phase === 'voting' || phase === 'voting_result') && <VotingPhase />}
        {phase === 'end_game'     && <EndGamePhase />}
      </motion.div>
    </AnimatePresence>
  )

  // Картка персонажа — використовується в обох лейаутах
  const characterCard = me && (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-black uppercase tracking-widest mb-1 flex items-center gap-1.5"
           style={{ color: 'var(--bunker-yellow)' }}>
        👤 Ваш персонаж
      </div>
      {Object.entries(me.attributes).map(([key, attr]) => {
        const color = ATTR_COLORS[key] || '#e09600'
        return (
          <div key={key}
               className="px-2 py-1.5 rounded-lg text-xs"
               style={{
                 background: `${color}0c`,
                 border: `1px solid ${color}20`,
                 borderLeftWidth: 2,
                 borderLeftColor: attr.isRevealed ? color : `${color}50`,
               }}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold" style={{ color: `${color}bb`, fontSize: 10 }}>
                {ATTR_LABELS[key]}
              </span>
              {!attr.isRevealed && (
                <span style={{ fontSize: 10, color: 'var(--bunker-muted)' }}>🔒</span>
              )}
            </div>
            <div className="text-white leading-snug" style={{ fontSize: 11 }}>{attr.value}</div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-col overflow-hidden" style={{ background: 'var(--bunker-bg)', height: '100dvh' }}>

      {/* ── Топбар (спільний) ── */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
           style={{
             background: 'linear-gradient(180deg, #0f1311 0%, #0b0d0c 100%)',
             borderBottom: '1px solid var(--bunker-border)',
             paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
           }}>

        <span className="text-lg flex-shrink-0">{scenario.emoji}</span>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-white truncate tracking-wide">{scenario.title}</div>
        </div>

        {/* Живих / місць */}
        <div className="flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-lg"
             style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--bunker-border)' }}>
          <span className="text-xs font-black text-white">{alive}</span>
          <span className="text-xs" style={{ color: 'var(--bunker-muted)' }}>/ {bunkerCapacity}</span>
        </div>

        {/* Десктоп: окремо фаза і таймер */}
        <div className="topbar-phase px-2.5 py-1 rounded-md text-xs font-black tracking-widest flex-shrink-0"
             style={{ background: pm.bg, color: pm.color, border: `1px solid ${pm.color}40` }}>
          {pm.label}
        </div>
        <div className="topbar-timer">
          <PhaseTimer deadline={gameState.timeDeadline} />
        </div>

        {/* Мобільний: компактний фаза + таймер */}
        <div className="topbar-phase-mobile flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs font-black px-2 py-0.5 rounded"
                style={{ background: pm.bg, color: pm.color }}>
            {pm.label}
          </span>
          <PhaseTimer deadline={gameState.timeDeadline} />
        </div>

        <button onClick={leaveGame}
                className="text-xs px-2.5 py-1 rounded-lg flex-shrink-0 transition-opacity hover:opacity-70"
                style={{ background: 'rgba(204,34,0,0.15)', color: '#ff7060', border: '1px solid rgba(204,34,0,0.3)' }}>
          ✕
        </button>
      </div>

      {/* ══════════════════════════════════════
          ДЕСКТОП: 3-колонковий грід
         ══════════════════════════════════════ */}
      <div className="game-body">

        <div className="game-center-top game-bg-texture">
          <PlayerGrid />
        </div>

        <div className="game-left-top">
          {me && (
            <>
              {characterCard}
              <div className="mt-2"><ActionCardPanel /></div>
            </>
          )}
        </div>

        <div className="game-center-bottom game-bg-texture">
          {phaseContent}
        </div>

        <div className="game-right">
          <ChatPanel />
        </div>

        <div className="game-left-bottom">
          <LogPanel />
        </div>
      </div>

      {/* ══════════════════════════════════════
          МОБІЛЬНИЙ: таб-навігація
         ══════════════════════════════════════ */}
      <div className={`mobile-game-body tab-${mobileTab}`}>

        {/* Вміст активної вкладки */}
        <div className="mobile-tab-content">

          {/* Вкладка: Гравці */}
          {mobileTab === 'players' && (
            <div ref={playersScrollRef} className="flex-1 overflow-y-auto min-h-0" style={{ paddingBottom: 16 }}>
              <div className="p-2 game-bg-texture">
                <PlayerGrid />
              </div>
              <div style={{ height: 1, background: 'var(--bunker-border)', margin: '0 8px' }} />
              <div className="p-2">
                {phaseContent}
              </div>
            </div>
          )}

          {/* Вкладка: Чат */}
          {mobileTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0 p-2">
              <ChatPanel />
            </div>
          )}

          {/* Вкладка: Я */}
          {mobileTab === 'me' && (
            <div className="flex-1 overflow-y-auto min-h-0 p-3 flex flex-col gap-3">
              {characterCard}
              <ActionCardPanel />
              <div style={{ height: 260 }}>
                <LogPanel />
              </div>
            </div>
          )}

          {/* Вкладка: Сценарій */}
          {mobileTab === 'scenario' && (
            <div className="flex-1 overflow-y-auto min-h-0 p-3 flex flex-col gap-3" style={{ paddingBottom: 16 }}>
              <div className="rounded-xl px-4 py-3 text-xs leading-relaxed"
                   style={{ background: 'var(--bunker-surface)', border: '1px solid rgba(204,34,0,0.2)', color: 'var(--bunker-text)' }}>
                <p className="text-white font-black text-sm mb-2">{scenario.emoji} {scenario.title}</p>
                <p className="mb-2"><strong className="text-white">💀</strong> {scenario.disaster}</p>
                <p className="mb-2"><strong className="text-white">🏚️</strong> {scenario.bunker}</p>
                <p><strong className="text-white">🎯</strong> {scenario.goal}</p>
              </div>

              {phase === 'discussion' && (
                <div className="rounded-xl overflow-hidden"
                     style={{ border: '1px solid rgba(60,150,100,0.3)' }}>
                  <div className="px-4 py-2 text-xs font-black uppercase tracking-widest"
                       style={{ background: 'rgba(60,150,100,0.12)', color: 'var(--bunker-green-bright)' }}>
                    💬 Час обговорення
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-1.5"
                       style={{ background: 'var(--bunker-surface)' }}>
                    {[
                      '🎯 Чим ваш персонаж корисний для виживання?',
                      '⚠️ Знайдіть слабкі місця у суперниках',
                      '🃏 Можна використати карти дій',
                    ].map((tip, i) => (
                      <div key={i} className="text-xs px-3 py-1.5 rounded-lg"
                           style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--bunker-muted2)' }}>
                        {tip}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* На старті — кнопка "Готовий" прямо на цій вкладці (fixed внизу) */}
              {phase === 'game_start' && <GameStartPhase />}
            </div>
          )}
        </div>

        {/* Нижня навігація */}
        <nav className="mobile-bottom-nav">
          {([
            { id: 'players'  as MobileTab, icon: '👥', label: 'Гравці' },
            { id: 'chat'     as MobileTab, icon: '💬', label: 'Чат',      badge: unreadChat },
            { id: 'me'       as MobileTab, icon: '👤', label: 'Я' },
            { id: 'scenario' as MobileTab, icon: '📋', label: 'Сценарій' },
          ]).map(tab => {
            const active = mobileTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative transition-opacity"
                style={{ color: active ? 'var(--bunker-yellow)' : 'var(--bunker-muted)', border: 'none', background: 'none' }}
              >
                {active && (
                  <div style={{
                    position: 'absolute', top: 0, left: '20%', right: '20%',
                    height: 2, background: 'var(--bunker-yellow)', borderRadius: '0 0 2px 2px',
                  }} />
                )}
                <span style={{ fontSize: 22 }}>{tab.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.03em' }}>{tab.label}</span>
                {'badge' in tab && tab.badge! > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 'calc(50% - 18px)',
                    background: 'var(--bunker-red)', color: '#fff',
                    fontSize: 9, fontWeight: 900, borderRadius: 999,
                    padding: '1px 5px', minWidth: 16, textAlign: 'center',
                    lineHeight: '14px',
                  }}>
                    {tab.badge! > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

    </div>
  )
}
