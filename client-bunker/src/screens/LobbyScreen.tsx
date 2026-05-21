import { useState } from 'react'
import { getSocket } from '../hooks/useSocket'
import { useGameStore } from '../store/gameStore'

export function LobbyScreen() {
  const [name, setName]   = useState(useGameStore.getState().myName)
  const [code, setCode]   = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setMyName, setRoom } = useGameStore()

  const validate = () => {
    if (!name.trim()) { setError('Введіть своє ім\'я'); return false }
    return true
  }

  const createRoom = () => {
    if (!validate()) return
    setLoading(true)
    setMyName(name.trim())
    getSocket().emit('createRoom', { playerName: name.trim(), gameType: 'bunker' }, (res) => {
      setLoading(false)
      if (res.error) { setError(res.error); return }
      setRoom(res.code, res.playerIndex, [name.trim()])
    })
  }

  const joinRoom = () => {
    if (!validate()) return
    if (!code.trim()) { setError('Введіть код кімнати'); return }
    setLoading(true)
    setMyName(name.trim())
    getSocket().emit('joinRoom', { code: code.trim().toUpperCase(), playerName: name.trim() }, (res) => {
      setLoading(false)
      if (res.error) { setError(res.error); return }
      setRoom(res.code, res.playerIndex, [])
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(100,20,0,0.4) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(200,100,0,0.15) 0%, transparent 55%), #111212' }}>

      <div className="w-full max-w-md flex flex-col gap-5">

        {/* Заголовок */}
        <div className="text-center">
          <div className="text-6xl mb-3">🏚️</div>
          <h1 className="text-3xl font-black text-white tracking-wide mb-1">БУНКЕР</h1>
          <p className="text-sm" style={{ color: 'var(--bunker-muted)' }}>
            Дискусійна гра на виживання · 4–15 гравців
          </p>
        </div>

        {/* Форма */}
        <div className="rounded-2xl p-6 flex flex-col gap-4"
             style={{ background: 'var(--bunker-surface)', border: '1px solid var(--bunker-border)' }}>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2"
                   style={{ color: 'var(--bunker-muted)' }}>
              Ваше ім'я
            </label>
            <input
              className="w-full rounded-lg px-4 py-3 text-white text-sm outline-none transition-all"
              style={{ background: '#111212', border: '1.5px solid var(--bunker-border)' }}
              placeholder="Як вас звати?"
              maxLength={20}
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && createRoom()}
              onFocus={e => e.target.style.borderColor = 'var(--bunker-yellow)'}
              onBlur={e => e.target.style.borderColor = 'var(--bunker-border)'}
            />
          </div>

          <button
            onClick={createRoom}
            disabled={loading}
            className="w-full py-3 rounded-xl font-black text-sm tracking-wide transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'var(--bunker-red)', color: 'white' }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
            onMouseLeave={e => (e.currentTarget.style.filter = '')}
          >
            🏠 Створити кімнату
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--bunker-border)' }} />
            <span className="text-xs" style={{ color: 'var(--bunker-muted)' }}>або приєднатись</span>
            <div className="flex-1 h-px" style={{ background: 'var(--bunker-border)' }} />
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg px-4 py-3 text-white text-sm outline-none uppercase tracking-widest font-bold transition-all"
              style={{ background: '#111212', border: '1.5px solid var(--bunker-border)' }}
              placeholder="Код (ABCD)"
              maxLength={6}
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
              onFocus={e => e.target.style.borderColor = 'var(--bunker-yellow)'}
              onBlur={e => e.target.style.borderColor = 'var(--bunker-border)'}
            />
            <button
              onClick={joinRoom}
              disabled={loading}
              className="px-5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
              style={{ background: '#2a3a2a', border: '1.5px solid var(--bunker-green)', color: '#7dd87d' }}
            >
              🔗
            </button>
          </div>

          {error && (
            <p className="text-center text-sm rounded-lg py-2 px-4"
               style={{ background: 'rgba(204,34,0,0.15)', color: '#ff8080', border: '1px solid rgba(204,34,0,0.3)' }}>
              {error}
            </p>
          )}
        </div>

        <p className="text-center text-xs" style={{ color: 'var(--bunker-muted)' }}>
          Частина проекту <a href="/" className="underline opacity-60 hover:opacity-100">Ігровий Клуб</a>
        </p>
      </div>
    </div>
  )
}
