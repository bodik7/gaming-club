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
         style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>
      <div className="px-3 py-2 text-xs font-bold uppercase tracking-widest flex-shrink-0"
           style={{ color: 'var(--bunker-muted)', borderBottom: '1px solid var(--bunker-border)' }}>
        💬 Чат
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1" style={{ minHeight: 0 }}>
        {chat.map((m, i) => (
          <div key={i} className="text-xs leading-snug">
            <span className="font-bold" style={{ color: m.color }}>{m.name}: </span>
            <span style={{ color: 'var(--bunker-text)' }}>{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex gap-1 p-2 flex-shrink-0"
           style={{ borderTop: '1px solid var(--bunker-border)' }}>
        <input
          className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
          style={{ background: '#111212', border: '1px solid var(--bunker-border)', color: 'white' }}
          placeholder={silenced ? '🔇 Ви заглушені' : 'Написати...'}
          disabled={silenced}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button onClick={send} disabled={silenced}
                className="px-2 py-1 rounded-lg text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-30"
                style={{ background: 'var(--bunker-red)', color: 'white' }}>
          ➤
        </button>
      </div>
    </div>
  )
}
