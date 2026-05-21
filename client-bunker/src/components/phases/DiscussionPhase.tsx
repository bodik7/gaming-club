export function DiscussionPhase() {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2"
         style={{ background: 'rgba(42,122,42,0.1)', border: '1px solid rgba(42,122,42,0.3)' }}>
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7dd87d' }}>
        💬 Час обговорення
      </div>
      <div className="text-xs leading-relaxed" style={{ color: 'var(--bunker-text)' }}>
        Аргументуйте чому ваш персонаж корисний. Вказуйте на слабкі місця інших.
        Можна застосувати карти дій (у вашій картці праворуч).
      </div>
    </div>
  )
}
