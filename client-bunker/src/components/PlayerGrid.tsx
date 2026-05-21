import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import type { BunkerPlayer } from '../types/bunker'

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
         style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
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
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: player.isAlive ? 1 : 0.4, y: 0 }}
      className="rounded-xl p-3 flex flex-col gap-2 relative"
      style={{
        background: 'var(--bunker-surface)',
        border: `1px solid ${marker === '🟢' ? '#2a7a2a' : marker === '🔴' ? 'var(--bunker-red)' : 'var(--bunker-border)'}`,
      }}
    >
      {/* Ім'я і маркери */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-white truncate">
          {!player.isAlive && '💀 '}{player.name}
        </span>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onMarker(marker === '🟢' ? null : '🟢')}
                  className="text-sm transition-opacity hover:opacity-80"
                  style={{ opacity: marker === '🟢' ? 1 : 0.3 }}>🟢</button>
          <button onClick={() => onMarker(marker === '🔴' ? null : '🔴')}
                  className="text-sm transition-opacity hover:opacity-80"
                  style={{ opacity: marker === '🔴' ? 1 : 0.3 }}>🔴</button>
        </div>
      </div>

      {/* Атрибути */}
      <div className="flex flex-col gap-1">
        {Object.entries(player.attributes).map(([key, attr]) => (
          <AnimatePresence key={key}>
            <AttributeRow icon={ATTR_ICONS[key]} attr={attr} />
          </AnimatePresence>
        ))}
      </div>

      {/* Карти дій */}
      <div className="flex gap-1 flex-wrap mt-1">
        {player.actionCards.map(card => (
          <span key={card.id}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: card.used ? 'rgba(255,255,255,0.05)' : 'rgba(245,196,0,0.1)',
                  color: card.used ? 'var(--bunker-muted)' : 'var(--bunker-yellow)',
                  textDecoration: card.used ? 'line-through' : 'none',
                }}>
            {card.name}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

function AttributeRow({ icon, attr }: { icon: string; attr: { value: string; isRevealed: boolean } }) {
  if (!attr.isRevealed) {
    return (
      <div className="flex items-center gap-1.5 text-xs py-1 px-2 rounded-lg"
           style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }}>
        <span className="opacity-30">{icon}</span>
        <span className="font-mono tracking-widest opacity-25">• • •</span>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      className="flex items-start gap-1.5 text-xs py-1 px-2 rounded-lg"
      style={{ background: 'rgba(245,196,0,0.06)', border: '1px solid rgba(245,196,0,0.12)' }}
    >
      <span className="flex-shrink-0 mt-px">{icon}</span>
      <span className="text-white leading-snug">{attr.value}</span>
    </motion.div>
  )
}
