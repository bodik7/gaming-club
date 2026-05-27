import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { AnimatePresence, motion } from 'framer-motion'
import { ACTION_CARD_PHASES } from '../constants/cardPhases'
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
import { haptic }            from '../utils/haptic'
import { sounds }            from '../utils/sounds'
import { requestNotificationPermission, notify } from '../utils/notifications'

const ATTR_LABELS: Record<string, string> = {
  profession: '💼 Професія',
  biology:    '🧬 Біологія',
  health:     '❤️ Здоров\'я',
  hobby:      '🎯 Хобі',
  trait:      '🧠 Риса',
  baggage:    '🎒 Багаж',
  fact:       '🔐 Факт',
}

const ATTR_COLORS: Record<string, string> = {
  profession: '#e09600',
  biology:    '#5cb87e',
  health:     '#cc5555',
  hobby:      '#6088cc',
  trait:      '#aa88cc',
  baggage:    '#cc8844',
  fact:       '#48b0c8',
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
  const logCount  = useGameStore(s => s.gameState?.log.length ?? 0)
  const [mobileTab, setMobileTab]         = useState<MobileTab>('players')
  const [lastSeenChat, setLastSeenChat]   = useState(0)
  const [lastSeenLog, setLastSeenLog]     = useState(0)
  const [confirmAttr, setConfirmAttr]     = useState<string | null>(null)
  const [showSplash, setShowSplash]         = useState(false)
  const [roundBanner, setRoundBanner]       = useState<number | null>(null)
  const [refutCountdown, setRefutCountdown] = useState<number | null>(null)
  const refutTimerRef                       = useRef<ReturnType<typeof setInterval> | null>(null)
  const splashShownRef                      = useRef(false)
  const prevRoundRef                        = useRef(0)
  const playersScrollRef = useRef<HTMLDivElement>(null)

  if (!gameState) return null

  const { phase, scenario, bunkerCapacity, players } = gameState
  const alive = players.filter(p => p.isAlive).length
  const me    = myIndex !== null ? players[myIndex] : null
  const pm    = PHASE_META[phase] || PHASE_META['game_start']

  const unreadChat      = mobileTab !== 'chat'     ? Math.max(0, chatCount - lastSeenChat) : 0
  const unreadLog       = mobileTab !== 'scenario' ? Math.max(0, logCount  - lastSeenLog)  : 0
  const availableCards  = me && !me.isBot
    ? me.actionCards.filter(c => !c.used && ((ACTION_CARD_PHASES as Record<string,string[]>)[c.id] || []).includes(phase)).length
    : 0
  const cardBadge = mobileTab !== 'me' ? availableCards : 0

  const revealAttr = useCallback((attr: string) => {
    getSocket().emit('action', { type: 'b_revealAttr', data: { attr } })
    setConfirmAttr(null)
    haptic('success')
    sounds.reveal()
  }, [])

  // Банер «РАУНД N» при кожному новому раунді
  useEffect(() => {
    if (phase !== 'round_reveal' || !gameState) return
    const round = gameState.round
    if (round > 0 && round !== prevRoundRef.current) {
      prevRoundRef.current = round
      setRoundBanner(round)
      haptic('medium')
      const t = setTimeout(() => setRoundBanner(null), 2400)
      return () => clearTimeout(t)
    }
  }, [phase, gameState?.round])

  // Попап «Спростування» — якщо гравець виганяється і має act_refut
  useEffect(() => {
    if (phase !== 'voting_result' || myIndex === null || !gameState) return

    const me = gameState.players[myIndex]
    const hasRefut = me?.isAlive && me?.actionCards.some(c => c.id === 'act_refut' && !c.used)
    if (!hasRefut) return

    // Перевіряємо чи саме цей гравець набрав найбільше голосів
    const votes = gameState.votes
    const counts: Record<number, number> = {}
    Object.values(votes).forEach(t => { counts[t] = (counts[t] || 0) + 1 })
    const maxVotes = Math.max(0, ...Object.values(counts))
    if (maxVotes === 0) return
    const topIds = gameState.players.filter(p => p.isAlive && (counts[p.id] || 0) === maxVotes).map(p => p.id)
    if (!topIds.includes(myIndex)) return

    // Якщо нічия (2+ людей) і це ПЕРША нічия (tiebreaker = null) — вони підуть на повторне
    // голосування, а не виганяються. Не показуємо попап марно.
    if (topIds.length > 1 && !gameState.tiebreaker) return

    // Запускаємо відлік 4 секунди
    setRefutCountdown(4)
    haptic('heavy')
    const iv = setInterval(() => {
      setRefutCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(iv)
          return null
        }
        return prev - 1
      })
    }, 1000)
    refutTimerRef.current = iv
    return () => clearInterval(iv)
  }, [phase])

  // Авто-переключення вкладок при зміні фази
  useEffect(() => {
    setConfirmAttr(null)
    const alive = me?.isAlive !== false
    if (phase === 'game_start') {
      setMobileTab('scenario')
      setLastSeenLog(logCount)
    } else if (phase === 'round_reveal') {
      // Мертвий хост залишається на 'players' щоб бачити статус раунду
      if (alive) setMobileTab('me')
      else setMobileTab('players')
    } else if (phase === 'discussion') {
      setMobileTab('players')
    } else if (phase === 'voting' || phase === 'end_game') {
      setMobileTab('players')
      setTimeout(() => playersScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 60)
    }
  }, [phase])

  // Після того як гравець розкрив атрибут — переключити на «Гравці»
  useEffect(() => {
    if (me?.hasRevealed && phase === 'round_reveal') {
      setTimeout(() => setMobileTab('players'), 600)
    }
  }, [me?.hasRevealed])

  // Запитати дозвіл на сповіщення при першому рендері
  useEffect(() => { requestNotificationPermission() }, [])

  // Сплеш-екран при першому старті гри
  useEffect(() => {
    if (phase === 'game_start' && !splashShownRef.current) {
      splashShownRef.current = true
      setShowSplash(true)
      const t = setTimeout(() => setShowSplash(false), 3000)
      return () => clearTimeout(t)
    }
  }, [phase])

  // Звук, хаптик і сповіщення при зміні фази
  const prevPhaseRef = useRef<string | null>(null)
  useEffect(() => {
    if (prevPhaseRef.current === null) { prevPhaseRef.current = phase; return }
    if (prevPhaseRef.current === phase) return
    prevPhaseRef.current = phase
    sounds.phaseStart()
    haptic('medium')
    const labels: Record<string, string> = {
      round_reveal: '🔓 Розкриття атрибутів',
      discussion:   '💬 Обговорення',
      voting:       '🗳️ Голосування',
      end_game:     '🏆 Гра завершена',
    }
    if (labels[phase]) notify('Бункер — ' + labels[phase])
    if (phase === 'end_game') { haptic('success'); sounds.win() }
  }, [phase])

  // Звук нового повідомлення в чаті
  const prevChatRef = useRef(chatCount)
  useEffect(() => {
    if (chatCount > prevChatRef.current) {
      if (mobileTab !== 'chat') sounds.chat()
    }
    prevChatRef.current = chatCount
  }, [chatCount])

  const switchTab = (tab: MobileTab) => {
    setMobileTab(tab)
    if (tab === 'chat')     setLastSeenChat(chatCount)
    if (tab === 'scenario') setLastSeenLog(logCount)
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

  const canReveal = phase === 'round_reveal' && me && !me.hasRevealed
  const allAttrsRevealed = me ? Object.values(me.attributes).every(a => a.isRevealed) : false

  // Картка персонажа — використовується в обох лейаутах
  const characterCard = me && (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-black uppercase tracking-widest mb-1 flex items-center gap-1.5"
           style={{ color: 'var(--bunker-yellow)' }}>
        👤 Ваш персонаж
        {canReveal && !allAttrsRevealed && (
          <span className="text-xs font-normal animate-pulse-urgent" style={{ color: 'var(--bunker-yellow)', fontSize: 9 }}>
            · натисни на 🔒 щоб розкрити
          </span>
        )}
      </div>
      {Object.entries(me.attributes).map(([key, attr]) => {
        const color = ATTR_COLORS[key] || '#e09600'
        const isClickable = canReveal && !attr.isRevealed && !allAttrsRevealed
        return (
          <div key={key}
               onClick={isClickable ? () => { setConfirmAttr(key); haptic('light') } : undefined}
               className={`px-2 py-1.5 rounded-lg text-xs${isClickable ? ' transition-all active:scale-95' : ''}`}
               style={{
                 background: isClickable ? `${color}14` : `${color}0c`,
                 border: `1px solid ${isClickable ? color + '50' : color + '20'}`,
                 borderLeftWidth: 2,
                 borderLeftColor: attr.isRevealed ? color : isClickable ? color : `${color}50`,
                 cursor: isClickable ? 'pointer' : 'default',
               }}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold" style={{ color: `${color}bb`, fontSize: 10 }}>
                {ATTR_LABELS[key]}
              </span>
              {!attr.isRevealed && (
                <span style={{ fontSize: 10, color: isClickable ? color : 'var(--bunker-muted)' }}>
                  {isClickable ? '👆' : '🔒'}
                </span>
              )}
            </div>
            <div className="text-white leading-snug" style={{ fontSize: 11 }}>{attr.value}</div>
          </div>
        )
      })}
      {/* Bug 5: all attrs revealed but round not yet marked done — show explicit "Ready" button */}
      {canReveal && allAttrsRevealed && (
        <button
          onClick={() => { revealAttr(Object.keys(me.attributes)[0]); haptic('success') }}
          className="mt-1 w-full py-2.5 rounded-xl text-sm font-black transition-all active:scale-95 animate-pulse-urgent"
          style={{
            background: 'linear-gradient(135deg, rgba(60,150,80,0.4), rgba(30,100,50,0.3))',
            border: '1px solid rgba(60,180,90,0.5)',
            color: 'var(--bunker-green-bright)',
            boxShadow: '0 0 12px rgba(60,180,90,0.2)',
          }}>
          ✅ Готовий до наступного раунду
        </button>
      )}
    </div>
  )

  // Попап підтвердження розкриття атрибута
  const confirmPopup = confirmAttr && me && (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4"
         style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
         onClick={() => setConfirmAttr(null)}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        className="w-full rounded-2xl overflow-hidden flex flex-col gap-3"
        style={{ maxWidth: 420, background: 'var(--bunker-surface2)', border: `1px solid ${(ATTR_COLORS[confirmAttr] || '#e09600')}40` }}>
        <div className="hazard-stripe" style={{ opacity: 0.45 }} />
        <div className="p-4 flex flex-col gap-3">
        <div className="text-xs font-black uppercase tracking-widest" style={{ color: ATTR_COLORS[confirmAttr] || '#e09600' }}>
          🔓 Розкрити атрибут?
        </div>
        <div className="px-3 py-2.5 rounded-xl" style={{
          background: `${ATTR_COLORS[confirmAttr] || '#e09600'}0e`,
          border: `1px solid ${ATTR_COLORS[confirmAttr] || '#e09600'}30`,
          borderLeftWidth: 3,
          borderLeftColor: ATTR_COLORS[confirmAttr] || '#e09600',
        }}>
          <div className="text-xs font-bold mb-1" style={{ color: `${ATTR_COLORS[confirmAttr] || '#e09600'}cc` }}>
            {ATTR_LABELS[confirmAttr]}
          </div>
          <div className="text-sm text-white font-medium">
            {me.attributes[confirmAttr as keyof typeof me.attributes]?.value}
          </div>
        </div>
        <p className="text-xs text-center" style={{ color: 'var(--bunker-muted)' }}>
          Цей атрибут побачать усі гравці. Впевнений?
        </p>
        <div className="flex gap-2">
          <button onClick={() => setConfirmAttr(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--bunker-muted2)', border: '1px solid var(--bunker-border2)' }}>
            Скасувати
          </button>
          <button onClick={() => revealAttr(confirmAttr)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all active:scale-95"
                  style={{
                    background: `linear-gradient(135deg, ${ATTR_COLORS[confirmAttr] || '#e09600'}cc, ${ATTR_COLORS[confirmAttr] || '#e09600'}88)`,
                    color: '#0b0d0c',
                    boxShadow: `0 2px 12px ${ATTR_COLORS[confirmAttr] || '#e09600'}40`,
                  }}>
            🔓 Розкрити
          </button>
        </div>
        </div>{/* /p-4 */}
      </motion.div>
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
          <motion.span key={phase} style={{ display: 'inline-block', animation: 'phase-pop 0.32s cubic-bezier(.22,.68,0,1.2)' }}>
            {pm.label}
          </motion.span>
        </div>
        <div className="topbar-timer">
          <PhaseTimer deadline={gameState.timeDeadline} />
        </div>

        {/* Мобільний: компактний фаза + таймер */}
        <div className="topbar-phase-mobile flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs font-black px-2 py-0.5 rounded"
                style={{ background: pm.bg, color: pm.color }}>
            <motion.span key={phase} style={{ display: 'inline-block', animation: 'phase-pop 0.32s cubic-bezier(.22,.68,0,1.2)' }}>
              {pm.label}
            </motion.span>
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

              {/* Хід гри — LogPanel вже має власний заголовок «📋 Хід гри» */}
              <div style={{ height: 260, flexShrink: 0 }}>
                <LogPanel />
              </div>
            </div>
          )}
        </div>

        {/* Нижня навігація */}
        <nav className="mobile-bottom-nav">
          {([
            { id: 'players'  as MobileTab, icon: '👥', label: 'Гравці' },
            { id: 'chat'     as MobileTab, icon: '💬', label: 'Чат',      badge: unreadChat },
            { id: 'me'       as MobileTab, icon: '👤', label: 'Я',        badge: cardBadge },
            { id: 'scenario' as MobileTab, icon: '📋', label: 'Сценарій', badge: unreadLog },
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
                    background: tab.id === 'me' ? '#c8a000' : 'var(--bunker-red)',
                    color: tab.id === 'me' ? '#0b0d0c' : '#fff',
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

      {/* Попап підтвердження розкриття */}
      <AnimatePresence>{confirmPopup}</AnimatePresence>

      {/* Попап «Спростування» — виганяють, але є карта порятунку */}
      <AnimatePresence>
        {refutCountdown !== null && me && (
          <motion.div
            key="refut-popup"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
          >
            <div className="w-full max-w-xs rounded-2xl overflow-hidden"
                 style={{ border: '2px solid rgba(245,196,0,0.5)', background: 'var(--bunker-surface2)' }}>
              <div className="hazard-stripe" style={{ opacity: 0.6 }} />
              <div className="p-5 flex flex-col items-center gap-4 text-center">
                <div className="text-5xl animate-emergency-glow">🛡️</div>
                <div>
                  <div className="text-base font-black text-white mb-1">Вас виганяють!</div>
                  <div className="text-xs" style={{ color: 'var(--bunker-muted2)' }}>
                    У вас є карта «🛡️ Спростування» — зіграйте щоб залишитись
                  </div>
                </div>

                {/* Відлік */}
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map(n => (
                    <div key={n}
                         className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300"
                         style={{
                           background: refutCountdown >= n ? 'rgba(245,196,0,0.3)' : 'rgba(255,255,255,0.04)',
                           border: `2px solid ${refutCountdown >= n ? 'rgba(245,196,0,0.7)' : 'var(--bunker-border)'}`,
                           color: refutCountdown >= n ? 'var(--bunker-yellow)' : 'var(--bunker-muted)',
                         }}>
                      {n}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 w-full">
                  <button
                    onClick={() => {
                      getSocket().emit('action', { type: 'b_useCard', data: { cardId: 'act_refut' } })
                      if (refutTimerRef.current) clearInterval(refutTimerRef.current)
                      setRefutCountdown(null)
                      haptic('success')
                    }}
                    className="w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245,196,0,0.35), rgba(200,150,0,0.25))',
                      border: '1.5px solid rgba(245,196,0,0.6)',
                      color: 'var(--bunker-yellow)',
                      boxShadow: '0 0 20px rgba(245,196,0,0.2)',
                    }}
                  >
                    🛡️ Зіграти Спростування!
                  </button>
                  <button
                    onClick={() => {
                      if (refutTimerRef.current) clearInterval(refutTimerRef.current)
                      setRefutCountdown(null)
                    }}
                    className="w-full py-2 rounded-xl text-xs"
                    style={{ color: 'var(--bunker-muted)', border: '1px solid var(--bunker-border)', background: 'transparent' }}
                  >
                    Відмовитись
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Банер нового раунду */}
      <AnimatePresence>
        {roundBanner !== null && (
          <motion.div
            key={`round-${roundBanner}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center pointer-events-none"
            style={{ background: 'rgba(9,11,10,0.75)', backdropFilter: 'blur(3px)' }}
          >
            <div className="hazard-stripe absolute top-0 left-0 right-0" style={{ height: 4, opacity: 0.9 }} />
            <div className="flex flex-col items-center gap-2">
              <div className="text-xs font-black uppercase tracking-[0.35em]"
                   style={{ color: 'rgba(204,34,0,0.7)', letterSpacing: '0.4em' }}>
                ☢ ВИЖИВАННЯ
              </div>
              <div style={{
                fontSize: 'clamp(64px, 18vw, 120px)',
                fontWeight: 900,
                color: '#fff',
                lineHeight: 1,
                animation: 'round-slam 0.55s cubic-bezier(.22,.68,0,1.2) forwards',
                textShadow: '0 0 40px rgba(204,34,0,0.6), 0 4px 30px rgba(0,0,0,0.8)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}>
                {roundBanner}
              </div>
              <div className="text-sm font-black uppercase tracking-[0.25em]"
                   style={{ color: 'var(--bunker-muted2)', letterSpacing: '0.3em' }}>
                РАУНД
              </div>
            </div>
            <div className="hazard-stripe absolute bottom-0 left-0 right-0" style={{ height: 4, opacity: 0.9 }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Сплеш-екран початку гри */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="scenario-splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center"
            style={{ background: 'rgba(9,9,11,0.96)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowSplash(false)}
          >
            <div className="hazard-stripe absolute top-0 left-0 right-0" />
            <motion.div
              initial={{ scale: 0.82, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 22 }}
              className="flex flex-col items-center gap-4 max-w-xs"
            >
              <div className="animate-emergency-glow text-5xl leading-none select-none">
                {scenario.emoji}
              </div>
              <div className="text-xs font-black uppercase tracking-[0.2em]"
                   style={{ color: 'var(--bunker-red)' }}>
                ☢ КАТАСТРОФА ОГОЛОШЕНА
              </div>
              <h2 className="text-lg font-black text-white leading-snug">
                {scenario.title}
              </h2>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--bunker-muted2)' }}>
                {scenario.disaster.length > 120
                  ? scenario.disaster.slice(0, 120) + '…'
                  : scenario.disaster}
              </p>
              <div className="text-xs mt-1 px-3 py-1.5 rounded-lg"
                   style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--bunker-muted)', border: '1px solid var(--bunker-border)' }}>
                Торкніться щоб продовжити
              </div>
            </motion.div>
            <div className="hazard-stripe absolute bottom-0 left-0 right-0" />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
