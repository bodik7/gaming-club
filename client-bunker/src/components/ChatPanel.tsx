import { useState, useRef, useEffect } from 'react'
import { getSocket } from '../hooks/useSocket'
import { useGameStore } from '../store/gameStore'

export function ChatPanel() {
  const [text, setText] = useState('')
  const { chat, myName, gameState } = useGameStore()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat])

  const send = () => {
    const t = text.trim()
    if (!t) return
    const me = gameState?.players[useGameStore.getState().myIndex ?? 0]
    if (me?.isSilenced) return
    getSocket().emit('chatMessage', { text: t, name: myName, icon: '💬', color: '#f5c400' })
    setText('')
  }

  const me = gameState?.players[useGameStore.getState().myIndex ?? 0]
  const silenced = me?.isSilenced || false

  return (
    <div className="flex-1 rounded-xl flex flex-col overflow-hidden min-h-0"
         style={{
           background: 'var(--bunker-surface)',
           border: '1px solid var(--bunker-border)',
           boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)',
         }}>

      {/* Заголовок */}
      <div className="px-3 py-1.5 text-xs font-black uppercase tracking-widest flex-shrink-0 flex items-center gap-1.5"
           style={{ color: 'var(--bunker-muted)', borderBottom: '1px solid var(--bunker-border)' }}>
        <span>💬</span> Чат
      </div>

      {/* Повідомлення */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5" style={{ minHeight: 0 }}>
        {chat.map((m, i) => {
          const isBot    = m.icon === '🤖'
          const isSystem = !m.name

          if (isSystem) {
            return (
              <div key={i} className="text-xs text-center py-0.5"
                   style={{ color: 'var(--bunker-muted)' }}>
                {m.text}
              </div>
            )
          }

          return (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="text-xs font-bold flex items-center gap-1"
                   style={{ color: m.color || 'var(--bunker-muted2)' }}>
                {m.icon && <span>{m.icon}</span>}
                <span>{m.name}</span>
              </div>
              <div className="text-xs px-2 py-1.5 rounded-lg rounded-tl-none leading-snug"
                   style={{
                     background: isBot
                       ? 'rgba(80,120,200,0.1)'
                       : 'rgba(255,255,255,0.04)',
                     border: `1px solid ${isBot ? 'rgba(80,120,200,0.25)' : 'var(--bunker-border)'}`,
                     color: 'var(--bunker-text)',
                   }}>
                {m.text}
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* Введення */}
      <div className="flex gap-1 p-2 flex-shrink-0"
           style={{ borderTop: '1px solid var(--bunker-border)' }}>
        <input
          className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none transition-all"
          style={{
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid var(--bunker-border)',
            color: 'white',
          }}
          placeholder={silenced ? '🔇 Ви заглушені' : 'Написати...'}
          disabled={silenced}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          onFocus={e => (e.target.style.borderColor = 'var(--bunker-border2)')}
          onBlur={e => (e.target.style.borderColor = 'var(--bunker-border)')}
        />
        <button onClick={send} disabled={silenced}
                className="px-2.5 py-1 rounded-lg text-xs font-black transition-opacity hover:opacity-80 disabled:opacity-30"
                style={{ background: 'var(--bunker-red)', color: 'white' }}>
          ➤
        </button>
      </div>
    </div>
  )
}
