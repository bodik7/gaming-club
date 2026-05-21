import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import type { BunkerPlayer, Attribute } from '../types/bunker'

const ATTR_ICONS: Record<string, string> = {
  profession: '💼', biology: '🧬', health: '❤️',
  hobby: '🎯', trait: '🧠', baggage: '🎒',
}

export function PlayerGrid() {
  const { gameState, myIndex, localMarkers, setLocalMarker } = useGameStore()
  if (!gameState) return null

  const others = gameState.players.filter((_, i) => i !== myIndex)

  return (
    <div className="grid gap-2"
         style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
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
  const borderColor = marker === '🟢' ? '#2a7a2a'
    : marker === '🔴' ? 'var(--bunker-red)'
    : 'var(--bunker-border)'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: player.isAlive ? 1 : 0.35, y: 0 }}
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: 'var(--bunker-surface)', border: `1px solid ${borderColor}` }}
    >
      {/* Ім'я + маркери */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-bold text-white truncate">
          {!player.isAlive ? '💀 ' : player.hasRevealed ? '✅ ' : ''}{player.isBot ? '🤖 ' : ''}{player.name}
        </span>
        <div className="flex gap-0.5 flex-shrink-0">
          <button onClick={() => onMarker(marker === '🟢' ? null : '🟢')}
                  style={{ opacity: marker === '🟢' ? 1 : 0.25, fontSize: 13 }}>🟢</button>
          <button onClick={() => onMarker(marker === '🔴' ? null : '🔴')}
                  style={{ opacity: marker === '🔴' ? 1 : 0.25, fontSize: 13 }}>🔴</button>
        </div>
      </div>

      {/* Атрибути */}
      <div className="flex flex-col gap-1">
        {Object.entries(player.attributes).map(([key, attr]) => (
          <AttributeRow key={key} icon={ATTR_ICONS[key]} attr={attr} />
        ))}
      </div>

      {/* Карти дій */}
      {player.actionCards.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {player.actionCards.map(card => (
            <span key={card.id}
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: card.used ? 'rgba(255,255,255,0.04)' : 'rgba(245,196,0,0.1)',
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

function AttributeRow({ icon, attr }: {
  icon: string
  attr: Attribute
}) {
  // Відстежуємо зміну isRevealed → анімація
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
           style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }}>
        <span style={{ opacity: 0.3 }}>{icon}</span>
        <span className="font-mono tracking-widest" style={{ opacity: 0.2 }}>• • •</span>
      </div>
    )
  }

  return (
    <motion.div
      initial={flip ? { rotateY: 90, opacity: 0 } : false}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.38, ease: 'easeOut' }}
      className="flex items-start gap-1.5 text-xs py-1 px-2 rounded-lg"
      style={{
        perspective: 600,
        background: 'rgba(245,196,0,0.06)',
        border: '1px solid rgba(245,196,0,0.15)',
      }}
    >
      <span className="flex-shrink-0 mt-px">{icon}</span>
      <span className="text-white leading-snug">{attr.value}</span>
    </motion.div>
  )
}
