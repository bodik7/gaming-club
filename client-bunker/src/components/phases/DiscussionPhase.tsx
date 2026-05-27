import { useGameStore } from '../../store/gameStore'
import { getSocket } from '../../hooks/useSocket'

export function DiscussionPhase() {
  const scenario = useGameStore(s => s.gameState?.scenario)
  const isHost   = useGameStore(s => s.isHost)
  const timerEnabled = useGameStore(s => s.gameState?.timerEnabled)

  const endDiscussion = () => {
    getSocket().emit('action', { type: 'b_endDiscussion', data: {} })
  }

  return (
    <div className="phase-fixed-panel">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Опис сценарію (на мобільному — окрема вкладка) */}
        {scenario && (
          <div className="phase-scenario-block rounded-xl overflow-hidden text-xs leading-relaxed"
               style={{ background: 'var(--bunker-surface)', border: '1px solid rgba(204,34,0,0.2)', color: 'var(--bunker-text)' }}>
            <div className="hazard-stripe" />
            <div className="px-4 py-2.5">
              <p className="mb-1"><strong className="text-white">💀</strong> {scenario.disaster}</p>
              <p className="mb-1"><strong className="text-white">🏚️</strong> {scenario.bunker}</p>
              <p><strong className="text-white">🎯</strong> {scenario.goal}</p>
            </div>
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

        {/* Кнопка хоста — завершити обговорення (тільки без таймера) */}
        {isHost && !timerEnabled && (
          <button
            onClick={endDiscussion}
            className="w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #cc2200, #992000)',
              color: 'white',
              boxShadow: '0 2px 12px rgba(204,34,0,0.3)',
            }}
          >
            🗳️ Розпочати голосування
          </button>
        )}
      </div>
    </div>
  )
}
