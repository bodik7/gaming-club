export function ReconnectingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4"
         style={{ background: '#0b0d0c' }}>
      <div style={{ fontSize: 48, animation: 'pulse-urgent 1.2s ease-in-out infinite' }}>⏳</div>
      <div className="text-white font-black text-lg tracking-wide">Відновлення з'єднання...</div>
      <div className="text-sm" style={{ color: 'var(--bunker-muted)' }}>Повертаємося до вашої кімнати</div>
    </div>
  )
}
