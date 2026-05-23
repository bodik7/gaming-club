export function DiscussionPhase() {
  return (
    <div className="rounded-xl overflow-hidden animate-fade-up"
         style={{ border: '1px solid rgba(60,150,100,0.3)' }}>
      <div className="px-4 py-2 text-xs font-black uppercase tracking-widest"
           style={{ background: 'rgba(60,150,100,0.12)', color: 'var(--bunker-green-bright)' }}>
        💬 Час обговорення
      </div>
      <div className="px-4 py-3 flex flex-col gap-2"
           style={{ background: 'var(--bunker-surface)' }}>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--bunker-text)' }}>
          Доведіть свою цінність. Аргументуйте, чому ви потрапите до бункера.
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            '🎯 Чим ваш персонаж корисний для виживання?',
            '⚠️ Знайдіть слабкі місця у суперниках',
            '🃏 Можна використати карти дій',
          ].map((tip, i) => (
            <div key={i} className="text-xs px-3 py-1.5 rounded-lg flex items-start gap-2"
                 style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--bunker-muted2)' }}>
              {tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
