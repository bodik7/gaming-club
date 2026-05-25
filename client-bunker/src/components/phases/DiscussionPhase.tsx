import { useGameStore } from '../../store/gameStore'

export function DiscussionPhase() {
  const scenario = useGameStore(s => s.gameState?.scenario)

  return (
    <div className="phase-fixed-panel" style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 40,
      padding: '0 16px',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      background: 'linear-gradient(to top, #0b0d0c 65%, transparent)',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Опис сценарію (на мобільному — окрема вкладка) */}
        {scenario && (
          <div className="phase-scenario-block rounded-xl px-4 py-2.5 text-xs leading-relaxed"
               style={{ background: 'var(--bunker-surface)', border: '1px solid rgba(204,34,0,0.2)', color: 'var(--bunker-text)' }}>
            <p className="mb-1"><strong className="text-white">💀</strong> {scenario.disaster}</p>
            <p className="mb-1"><strong className="text-white">🏚️</strong> {scenario.bunker}</p>
            <p><strong className="text-white">🎯</strong> {scenario.goal}</p>
          </div>
        )}

        {/* Підказки обговорення */}
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
      </div>
    </div>
  )
}
