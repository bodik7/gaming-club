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

export function PlayerGrid() {
  const { gameState, myIndex, localMarkers, setLocalMarker } = useGameStore()
  if (!gameState) return null

  const others = gameState.players.filter((_, i) => i !== myIndex)

  return (
    <div className="grid gap-2"
         style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))' }}>
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

  const borderColor = isDead         ? 'var(--bunker-border)'
    : marker === '🟢'               ? 'var(--bunker-green)'
    : marker === '🔴'               ? 'var(--bunker-red)'
    : isBot                          ? 'rgba(80,120,200,0.35)'
    : 'var(--bunker-border)'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isDead ? 0.28 : 1, y: 0 }}
      className="rounded-xl p-3 flex flex-col gap-2 relative overflow-hidden"
      style={{
        background: isBot && !isDead
          ? 'rgba(40,60,110,0.25)'
          : 'var(--bunker-surface)',
        border: `1px solid ${borderColor}`,
        filter: isDead ? 'grayscale(0.85)' : 'none',
        boxShadow: isDead ? 'none' : marker ? `0 0 0 1px ${borderColor}30` : 'none',
      }}
    >
      {/* Діагональний overlay для вибулих */}
      {isDead && (
        <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden"
             style={{
               background: 'repeating-linear-gradient(-45deg, transparent, transparent 7px, rgba(204,34,0,0.07) 7px, rgba(204,34,0,0.07) 8px)',
             }} />
      )}

      {/* Ім'я + маркери */}
      <div className="flex items-center justify-between gap-1 relative">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {isDead && (
            <span className="px-1.5 py-px rounded text-white font-black flex-shrink-0"
                  style={{ background: 'rgba(180,30,0,0.5)', fontSize: 9, letterSpacing: '0.05em' }}>
              ВИБУВ
            </span>
          )}
          {!isDead && player.hasRevealed && (
            <span style={{ color: 'var(--bunker-green-bright)', fontSize: 11, flexShrink: 0 }}>✓</span>
          )}
          <span className="text-sm font-bold text-white truncate"
                style={{
                  textDecoration: isDead ? 'line-through' : 'none',
                  textDecorationColor: 'rgba(255,60,30,0.5)',
                  color: isBot && !isDead ? '#8ab0ee' : 'white',
                }}>
            {isBot ? '🤖 ' : ''}{player.name}
          </span>
        </div>

        {!isDead && (
          <div className="flex gap-0.5 flex-shrink-0">
            <button onClick={() => onMarker(marker === '🟢' ? null : '🟢')}
                    style={{ opacity: marker === '🟢' ? 1 : 0.2, fontSize: 12, transition: 'opacity 0.15s' }}>🟢</button>
            <button onClick={() => onMarker(marker === '🔴' ? null : '🔴')}
                    style={{ opacity: marker === '🔴' ? 1 : 0.2, fontSize: 12, transition: 'opacity 0.15s' }}>🔴</button>
          </div>
        )}
      </div>

      {/* Атрибути */}
      <div className="flex flex-col gap-1 relative">
        {Object.entries(player.attributes).map(([key, attr]) => (
          <AttributeRow key={key} attrKey={key} icon={ATTR_ICONS[key]} attr={attr} />
        ))}
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
  const prevRef  = useRef(attr.isRevealed)
  const [flip, setFlip] = useState(false)

  useEffect(() => {
    if (!prevRef.current && attr.isRevealed) {
      setFlip(true)
      const t = setTimeout(() => setFlip(false), 500)
      return () => clearTimeout(t)
    }
    prevRef.current = attr.isRevealed
  }, [attr.isRevealed])

  if (!attr.isRevealed) {
    return (
      <div className="flex items-center gap-1.5 text-xs py-1 px-2 rounded-lg"
           style={{
             background: 'rgba(255,255,255,0.02)',
             border: '1px dashed rgba(255,255,255,0.07)',
           }}>
        <span style={{ opacity: 0.2 }}>{icon}</span>
        <span style={{ opacity: 0.15, letterSpacing: '0.3em', fontFamily: 'monospace' }}>···</span>
      </div>
    )
  }

  const color = ATTR_COLORS[attrKey] || '#e09600'

  return (
    <motion.div
      initial={flip ? { rotateY: 90, opacity: 0 } : false}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.38, ease: 'easeOut' }}
      className="flex items-start gap-1.5 text-xs py-1 px-2 rounded-lg"
      style={{
        perspective: 600,
        background: `${color}10`,
        border: `1px solid ${color}22`,
        borderLeftColor: `${color}99`,
        borderLeftWidth: 2,
      }}
    >
      <span className="flex-shrink-0 mt-px">{icon}</span>
      <span className="text-white leading-snug">{attr.value}</span>
    </motion.div>
  )
}
