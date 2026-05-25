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

export function GameScreen() {
  const { gameState, myIndex, setLeavingToHub } = useGameStore()
  if (!gameState) return null

  const { phase, scenario, bunkerCapacity, players } = gameState
  const alive = players.filter(p => p.isAlive).length
  const me    = myIndex !== null ? players[myIndex] : null
  const pm    = PHASE_META[phase] || PHASE_META['game_start']

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

  return (
    <div className="flex flex-col overflow-hidden" style={{ background: 'var(--bunker-bg)', height: '100dvh' }}>

      {/* ── Topbar ── */}
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

        {/* Фаза — ховається на мобільному */}
        <div className="topbar-phase px-2.5 py-1 rounded-md text-xs font-black tracking-widest flex-shrink-0"
             style={{ background: pm.bg, color: pm.color, border: `1px solid ${pm.color}40` }}>
          {pm.label}
        </div>

        {/* Таймер — ховається на мобільному */}
        <div className="topbar-timer">
          <PhaseTimer deadline={gameState.timeDeadline} />
        </div>

        {/* На мобільному — компактний статус фази + таймер в одному рядку */}
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

      {/* ── Основне тіло ── */}
      <div className="game-body">

        {/* ═══ Картки інших гравців ═══ */}
        <div className="game-center-top game-bg-texture">
          <PlayerGrid />
        </div>

        {/* ═══ Мій персонаж + Карти дій ═══ */}
        <div className="game-left-top">
          {me && (
            <>
              <div className="text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-1.5"
                   style={{ color: 'var(--bunker-yellow)' }}>
                👤 Ваш персонаж
              </div>
              <div className="flex flex-col gap-1 mb-2">
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
            </>
          )}
          <ActionCardPanel />
        </div>

        {/* ═══ Фаза / Сценарій ═══ */}
        <div className="game-center-bottom game-bg-texture">
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
        </div>

        {/* ═══ Чат ═══ */}
        <div className="game-right">
          <ChatPanel />
        </div>

        {/* ═══ Хід гри ═══ */}
        <div className="game-left-bottom">
          <LogPanel />
        </div>

      </div>
    </div>
  )
}
