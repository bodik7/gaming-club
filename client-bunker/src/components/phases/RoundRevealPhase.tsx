import { useState } from 'react'
import { getSocket } from '../../hooks/useSocket'
import { useGameStore } from '../../store/gameStore'

const ATTR_LABELS: Record<string, string> = {
  profession: '💼 Професія',
  biology:    '🧬 Біологія',
  health:     '❤️ Здоров\'я',
  hobby:      '🎯 Хобі',
  trait:      '🧠 Риса характеру',
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

const FORCED: Record<number, string> = { 1: 'profession', 2: 'biology' }

export function RoundRevealPhase() {
  const { gameState, myIndex } = useGameStore()
  const [selected, setSelected] = useState<string | null>(null)
  if (!gameState || myIndex === null) return null

  const { round, players, scenario } = gameState
  const me             = players[myIndex]
  const forced         = FORCED[round]
  const alreadyRevealed = me.hasRevealed

  const hidden = Object.entries(me.attributes)
    .filter(([, v]) => !v.isRevealed)
    .map(([k]) => k)

  const reveal = (attr: string) => {
    getSocket().emit('action', { type: 'b_revealAttr', data: { attr } })
  }

  // ── Вільний вибір: список атрибутів у скролі ──
  const attrPicker = !forced && !alreadyRevealed && (
    <div className="flex flex-col gap-2 animate-fade-up" style={{ paddingBottom: 220 }}>
      <div className="text-xs font-black uppercase tracking-widest px-1 mb-1"
           style={{ color: 'var(--bunker-yellow)' }}>
        Раунд {round} · Оберіть що розкрити
      </div>
      {hidden.map(key => {
        const attr  = me.attributes[key as keyof typeof me.attributes]
        const color = ATTR_COLORS[key] || '#e09600'
        const isSel = selected === key
        return (
          <button key={key}
                  onClick={() => setSelected(key === selected ? null : key)}
                  className="text-left px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: isSel ? `${color}14` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isSel ? color + '50' : 'var(--bunker-border)'}`,
                    borderLeftWidth: isSel ? 3 : 1,
                    borderLeftColor: isSel ? color : 'var(--bunker-border)',
                  }}>
            <div className="text-xs font-bold" style={{ color: isSel ? color : 'var(--bunker-muted2)' }}>
              {ATTR_LABELS[key]}
            </div>
            <div className="text-sm text-white mt-0.5">{attr.value}</div>
          </button>
        )
      })}
    </div>
  )

  // ── Фіксована нижня панель ──
  const color = forced ? (ATTR_COLORS[forced] || 'var(--bunker-yellow)') : (selected ? (ATTR_COLORS[selected] || '#e09600') : '#e09600')

  return (
    <>
      {attrPicker}

      <div className="phase-fixed-panel" style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 40,
        padding: '0 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: 'linear-gradient(to top, #0b0d0c 65%, transparent)',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Опис сценарію — завжди видимий (на мобільному — окрема вкладка) */}
          <div className="phase-scenario-block rounded-xl px-4 py-2.5 text-xs leading-relaxed"
               style={{ background: 'var(--bunker-surface)', border: '1px solid rgba(204,34,0,0.2)', color: 'var(--bunker-text)' }}>
            <p className="mb-1"><strong className="text-white">💀</strong> {scenario.disaster}</p>
            <p className="mb-1"><strong className="text-white">🏚️</strong> {scenario.bunker}</p>
            <p><strong className="text-white">🎯</strong> {scenario.goal}</p>
          </div>

          {/* Вже розкрив */}
          {alreadyRevealed && (
            <div className="rounded-xl px-4 py-3 text-center"
                 style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
              <span className="text-sm font-black text-white">✅ Атрибут розкрито</span>
              <span className="text-xs ml-2" style={{ color: 'var(--bunker-muted)' }}>чекаємо інших...</span>
            </div>
          )}

          {/* Обов'язкове розкриття */}
          {!alreadyRevealed && forced && (() => {
            const attr = me.attributes[forced as keyof typeof me.attributes]
            return (
              <>
                <div className="px-3 py-3 rounded-xl"
                     style={{ background: `${color}0e`, border: `1px solid ${color}30`, borderLeftWidth: 3, borderLeftColor: color }}>
                  <div className="text-xs font-bold mb-1" style={{ color: `${color}cc` }}>
                    Раунд {round} · {ATTR_LABELS[forced]}
                  </div>
                  <div className="text-sm text-white font-medium">{attr.value}</div>
                </div>
                <button onClick={() => reveal(forced)}
                        className="w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95"
                        style={{
                          background: `linear-gradient(135deg, ${color}cc, ${color}88)`,
                          color: '#0b0d0c',
                          boxShadow: `0 2px 12px ${color}40`,
                        }}>
                  🔓 Розкрити для всіх
                </button>
              </>
            )
          })()}

          {/* Вільний вибір: підтвердити вибраний атрибут */}
          {!alreadyRevealed && !forced && (
            selected ? (
              <>
                <div className="px-3 py-2 rounded-xl text-xs"
                     style={{ background: `${color}0e`, border: `1px solid ${color}30`, borderLeftColor: color, borderLeftWidth: 3 }}>
                  <span className="font-bold" style={{ color }}>Обрано: </span>
                  <span className="text-white">{ATTR_LABELS[selected]}</span>
                </div>
                <button onClick={() => reveal(selected)}
                        className="w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95"
                        style={{
                          background: 'linear-gradient(135deg, #cc2200, #992000)',
                          color: 'white',
                          boxShadow: '0 2px 12px rgba(204,34,0,0.3)',
                        }}>
                  🔓 Розкрити «{ATTR_LABELS[selected]}»
                </button>
              </>
            ) : (
              <div className="text-center text-xs py-2" style={{ color: 'var(--bunker-muted)' }}>
                ↑ Оберіть атрибут для розкриття
              </div>
            )
          )}
        </div>
      </div>
    </>
  )
}
