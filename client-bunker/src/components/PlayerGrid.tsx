import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import type { BunkerPlayer, Attribute } from '../types/bunker'

const ATTR_ICONS: Record<string, string> = {
  profession: '💼', biology: '🧬', health: '❤️',
  hobby: '🎯', trait: '🧠', baggage: '🎒',
}

const ATTR_COLORS: Record<string, string> = {
  profession: '#e09600',
  biology:    '#5cb87e',
  health:     '#cc5555',
  hobby:      '#6088cc',
  trait:      '#aa88cc',
  baggage:    '#cc8844',
}

// Кольори аватарок — по імені (hash)
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
         style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
      {others.map(player => (
        <PlayerCard
          key={player.id}
          player={player}
          marker={localMarkers[player.id] || null}
          onMarker={(m) => setLocalMarker(player.id, m)}
        />
      ))}
    </div>
  )
}

function PlayerCard({
  player, marker, onMarker,
}: {
  player: BunkerPlayer
  marker: '🟢' | '🔴' | null
  onMarker: (m: '🟢' | '🔴' | null) => void
}) {
  const isDead = !player.isAlive
  const isBot  = player.isBot

  const hiddenCount   = Object.values(player.attributes).filter(a => !a.isRevealed).length
  const revealedAttrs = Object.entries(player.attributes).filter(([, a]) => a.isRevealed)

  const borderColor = isDead         ? 'var(--bunker-border)'
    : marker === '🟢'               ? '#3a7a5a'
    : marker === '🔴'               ? 'var(--bunker-red)'
    : isBot                          ? 'rgba(80,120,200,0.3)'
    : 'var(--bunker-border)'

  const aColor = avatarColor(player.name)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isDead ? 0.28 : 1, y: 0 }}
      className="rounded-xl p-2.5 flex flex-col gap-2 relative overflow-hidden"
      style={{
        background: isBot && !isDead ? 'rgba(35,55,100,0.3)' : 'var(--bunker-surface)',
        border: `1px solid ${borderColor}`,
        filter: isDead ? 'grayscale(0.85)' : 'none',
      }}
    >
      {/* Overlay для вибулих */}
      {isDead && (
        <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden"
             style={{
               background: 'repeating-linear-gradient(-45deg, transparent, transparent 7px, rgba(204,34,0,0.06) 7px, rgba(204,34,0,0.06) 8px)',
             }} />
      )}

      {/* ── Заголовок картки ── */}
      <div className="flex items-center gap-2 relative">
        {/* Аватарка */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
             style={{
               background: isDead ? 'rgba(100,100,100,0.3)' : `${aColor}28`,
               border: `1.5px solid ${isDead ? 'rgba(100,100,100,0.3)' : aColor + '70'}`,
               color: isDead ? '#666' : aColor,
             }}>
          {isBot ? '🤖' : player.name[0]?.toUpperCase()}
        </div>

        {/* Ім'я */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {isDead && (
              <span className="px-1 py-px rounded font-black flex-shrink-0"
                    style={{ background: 'rgba(180,30,0,0.5)', color: '#ff6060', fontSize: 8, letterSpacing: '0.05em' }}>
                ВИБУВ
              </span>
            )}
            {!isDead && player.hasRevealed && (
              <span style={{ color: 'var(--bunker-green-bright)', fontSize: 10, flexShrink: 0 }}>✓</span>
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

        {/* Маркери (тільки живих) */}
        {!isDead && (
          <div className="flex gap-0.5 flex-shrink-0">
            <button onClick={() => onMarker(marker === '🟢' ? null : '🟢')}
                    style={{ opacity: marker === '🟢' ? 1 : 0.18, fontSize: 11 }}>🟢</button>
            <button onClick={() => onMarker(marker === '🔴' ? null : '🔴')}
                    style={{ opacity: marker === '🔴' ? 1 : 0.18, fontSize: 11 }}>🔴</button>
          </div>
        )}
      </div>

      {/* ── Атрибути ── */}
      <div className="flex flex-col gap-1 relative">
        {/* Розкриті атрибути */}
        {revealedAttrs.map(([key, attr]) => (
          <AttributeRow key={key} attrKey={key} icon={ATTR_ICONS[key]} attr={attr} />
        ))}

        {/* Приховані — одна компактна плашка */}
        {hiddenCount > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
               style={{
                 background: 'rgba(255,255,255,0.02)',
                 border: '1px dashed rgba(255,255,255,0.07)',
                 color: 'var(--bunker-muted)',
               }}>
            <span style={{ opacity: 0.4 }}>🔒</span>
            <span>{hiddenCount} {hiddenCount === 1 ? 'атрибут прихований' : hiddenCount < 5 ? 'атрибути приховані' : 'атрибутів приховано'}</span>
          </div>
        )}
      </div>

      {/* Карти дій */}
      {player.actionCards.length > 0 && (
        <div className="flex gap-1 flex-wrap relative">
          {player.actionCards.map(card => (
            <span key={card.id}
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: card.used ? 'rgba(255,255,255,0.03)' : 'rgba(224,150,0,0.1)',
                    color: card.used ? 'var(--bunker-muted)' : 'var(--bunker-yellow)',
                    textDecoration: card.used ? 'line-through' : 'none',
                    fontSize: 10,
                  }}>
              {card.name}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function AttributeRow({ attrKey, icon, attr }: {
  attrKey: string
  icon: string
  attr: Attribute
}) {
  const prevRef = useRef(attr.isRevealed)
  const [flip, setFlip] = useState(false)

  useEffect(() => {
    if (!prevRef.current && attr.isRevealed) {
      setFlip(true)
      const t = setTimeout(() => setFlip(false), 500)
      return () => clearTimeout(t)
    }
    prevRef.current = attr.isRevealed
  }, [attr.isRevealed])

  const color = ATTR_COLORS[attrKey] || '#e09600'

  return (
    <motion.div
      initial={flip ? { rotateY: 90, opacity: 0 } : false}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.38, ease: 'easeOut' }}
      className="flex items-start gap-1.5 text-xs py-1 px-2 rounded-lg"
      style={{
        perspective: 600,
        background: `${color}0e`,
        border: `1px solid ${color}20`,
        borderLeftWidth: 2,
        borderLeftColor: `${color}88`,
      }}
    >
      <span className="flex-shrink-0 mt-px" style={{ fontSize: 11 }}>{icon}</span>
      <span className="text-white leading-snug">{attr.value}</span>
    </motion.div>
  )
}
