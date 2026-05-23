import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import type { BunkerPlayer, Attribute } from '../types/bunker'

const ATTR_ICONS: Record<string, string> = {
  profession: '💼', biology: '🧬', health: '❤️',
  hobby: '🎯', trait: '🧠', baggage: '🎒',
}

const ATTR_LABELS: Record<string, string> = {
  profession: 'Професія', biology: 'Біологія', health: "Здоров'я",
  hobby: 'Хобі', trait: 'Риса', baggage: 'Багаж',
}

const ATTR_COLORS: Record<string, string> = {
  profession: '#e09600',
  biology:    '#5cb87e',
  health:     '#cc5555',
  hobby:      '#6088cc',
  trait:      '#aa88cc',
  baggage:    '#cc8844',
}

const ATTR_ORDER = ['profession', 'biology', 'health', 'hobby', 'trait', 'baggage']

const AVATAR_COLORS = [
  '#6088cc', '#5cb87e', '#cc8844', '#aa88cc',
  '#cc5555', '#e09600', '#2a9090', '#cc6699',
]
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function PlayerGrid() {
  const { gameState, myIndex, localMarkers, setLocalMarker } = useGameStore()
  if (!gameState) return null

  const others = gameState.players.filter((_, i) => i !== myIndex)

  return (
    <div className="grid gap-2"
         style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
      {others.map((player, i) => (
        <PlayerCard
          key={player.id}
          player={player}
          index={i}
          marker={localMarkers[player.id] || null}
          onMarker={(m) => setLocalMarker(player.id, m)}
        />
      ))}
    </div>
  )
}

function PlayerCard({
  player, index, marker, onMarker,
}: {
  player: BunkerPlayer
  index: number
  marker: '🟢' | '🔴' | null
  onMarker: (m: '🟢' | '🔴' | null) => void
}) {
  const isDead = !player.isAlive
  const isBot  = player.isBot

  const revealedAttrs = Object.entries(player.attributes).filter(([, a]) => a.isRevealed)
  const hiddenKeys    = ATTR_ORDER.filter(k => !player.attributes[k as keyof typeof player.attributes]?.isRevealed)

  const borderColor = isDead         ? 'var(--bunker-border)'
    : marker === '🟢'               ? '#3a7a5a'
    : marker === '🔴'               ? 'var(--bunker-red)'
    : isBot                          ? 'rgba(80,120,200,0.3)'
    : 'var(--bunker-border)'

  const glowColor = marker === '🟢' ? 'rgba(58,122,90,0.35)'
    : marker === '🔴'               ? 'rgba(204,34,0,0.35)'
    : 'transparent'

  const aColor = avatarColor(player.name)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{
        opacity: isDead ? 0.28 : 1,
        y: 0,
        scale: isDead ? 0.98 : 1,
      }}
      transition={{
        delay: index * 0.06,
        type: 'spring',
        stiffness: 260,
        damping: 24,
      }}
      whileHover={!isDead ? {
        y: -4,
        transition: { duration: 0.15, ease: 'easeOut' },
      } : {}}
      className="rounded-xl p-2.5 flex flex-col gap-2 relative overflow-hidden cursor-default"
      style={{
        background: isBot && !isDead ? 'rgba(35,55,100,0.3)' : 'var(--bunker-surface)',
        border: `1px solid ${borderColor}`,
        filter: isDead ? 'grayscale(0.85)' : 'none',
        boxShadow: isDead ? 'none' : marker ? `0 0 0 1px ${borderColor}30, 0 4px 16px ${glowColor}` : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Overlay для вибулих */}
      {isDead && (
        <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden"
             style={{
               background: 'repeating-linear-gradient(-45deg, transparent, transparent 7px, rgba(204,34,0,0.06) 7px, rgba(204,34,0,0.06) 8px)',
             }} />
      )}

      {/* ── Заголовок ── */}
      <div className="flex items-center gap-2 relative">
        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
             style={{
               background: isDead ? 'rgba(100,100,100,0.2)' : `${aColor}22`,
               border: `1.5px solid ${isDead ? 'rgba(100,100,100,0.3)' : aColor + '60'}`,
               color: isDead ? '#555' : aColor,
             }}>
          {isBot ? '🤖' : player.name[0]?.toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-px">
            {isDead && (
              <span className="px-1 py-px rounded font-black flex-shrink-0"
                    style={{ background: 'rgba(180,30,0,0.5)', color: '#ff6060', fontSize: 8, letterSpacing: '0.05em' }}>
                ВИБУВ
              </span>
            )}
            {!isDead && player.hasRevealed && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                style={{ color: 'var(--bunker-green-bright)', fontSize: 10 }}>✓</motion.span>
            )}
          </div>
          <div className="text-sm font-bold truncate"
               style={{
                 color: isBot && !isDead ? '#8ab0ee' : isDead ? '#555' : 'white',
                 textDecoration: isDead ? 'line-through' : 'none',
                 textDecorationColor: 'rgba(255,60,30,0.4)',
                 lineHeight: 1.2,
               }}>
            {player.name}
          </div>
        </div>

        {!isDead && (
          <div className="flex gap-0.5 flex-shrink-0">
            <motion.button
              whileTap={{ scale: 1.5 }}
              onClick={() => onMarker(marker === '🟢' ? null : '🟢')}
              style={{ opacity: marker === '🟢' ? 1 : 0.18, fontSize: 11 }}>🟢</motion.button>
            <motion.button
              whileTap={{ scale: 1.5 }}
              onClick={() => onMarker(marker === '🔴' ? null : '🔴')}
              style={{ opacity: marker === '🔴' ? 1 : 0.18, fontSize: 11 }}>🔴</motion.button>
          </div>
        )}
      </div>

      {/* ── Атрибути: всі 6 слотів (відкриті + приховані) ── */}
      <div className="flex flex-col gap-1 relative">
        <AnimatePresence>
          {revealedAttrs.map(([key, attr]) => (
            <AttributeRow key={key} attrKey={key} icon={ATTR_ICONS[key]} attr={attr} />
          ))}
        </AnimatePresence>
        {hiddenKeys.map(key => (
          <LockedAttrRow key={key} attrKey={key} icon={ATTR_ICONS[key]} />
        ))}
      </div>

      {/* Карти дій — тільки кількість (назви приховані від інших) */}
      {player.actionCards.length > 0 && (
        <div className="flex items-center gap-1 relative">
          {player.actionCards.map(card => (
            <span key={card.id}
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: card.used ? 'rgba(255,255,255,0.03)' : 'rgba(224,150,0,0.08)',
                    color: card.used ? 'var(--bunker-muted)' : 'var(--bunker-yellow)',
                    fontSize: 10, opacity: card.used ? 0.4 : 1,
                  }}>
              🃏
            </span>
          ))}
          <span className="text-xs" style={{ color: 'var(--bunker-muted)', fontSize: 10 }}>
            {player.actionCards.filter(c => !c.used).length > 0
              ? `${player.actionCards.filter(c => !c.used).length} карт`
              : 'всі використані'}
          </span>
        </div>
      )}
    </motion.div>
  )
}

function LockedAttrRow({ attrKey, icon }: { attrKey: string; icon: string }) {
  const color = ATTR_COLORS[attrKey] || '#e09600'
  return (
    <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg"
         style={{
           background: `${color}07`,
           border: `1px solid ${color}12`,
           borderLeftWidth: 2,
           borderLeftColor: `${color}30`,
         }}>
      <span className="flex-shrink-0" style={{ fontSize: 12, opacity: 0.35 }}>{icon}</span>
      <span style={{ color: `${color}60`, fontSize: 11, fontWeight: 600 }}>
        {ATTR_LABELS[attrKey]}
      </span>
      <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 10, opacity: 0.3 }}>🔒</span>
    </div>
  )
}

function AttributeRow({ attrKey, icon, attr }: {
  attrKey: string
  icon: string
  attr: Attribute
}) {
  const prevRef = useRef(attr.isRevealed)
  const [isNew, setIsNew] = useState(false)

  useEffect(() => {
    if (!prevRef.current && attr.isRevealed) {
      setIsNew(true)
      const t = setTimeout(() => setIsNew(false), 800)
      return () => clearTimeout(t)
    }
    prevRef.current = attr.isRevealed
  }, [attr.isRevealed])

  const color = ATTR_COLORS[attrKey] || '#e09600'

  return (
    <motion.div
      initial={{ opacity: 0, rotateX: -90, scale: 0.85 }}
      animate={{ opacity: 1, rotateX: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className="flex items-start gap-2 text-xs py-1.5 px-2.5 rounded-lg"
      style={{
        perspective: 800,
        background: isNew ? `${color}22` : `${color}0e`,
        border: `1px solid ${isNew ? color + '55' : color + '20'}`,
        borderLeftWidth: 2,
        borderLeftColor: `${color}99`,
        boxShadow: isNew ? `0 0 12px ${color}40` : 'none',
        transition: 'background 0.5s ease, box-shadow 0.5s ease, border-color 0.5s ease',
      }}
    >
      <span className="flex-shrink-0 mt-px" style={{ fontSize: 12 }}>{icon}</span>
      <span className="text-white leading-snug" style={{ fontSize: 12 }}>{attr.value}</span>
    </motion.div>
  )
}
