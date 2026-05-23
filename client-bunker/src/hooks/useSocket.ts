import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useGameStore } from '../store/gameStore'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ transports: ['websocket'] })
  }
  return socket
}

// Ключ сесії — той самий що використовує client.js у головному лобі
const SESSION_KEY = 'monopolia_session'

export function useSocket() {
  const initialized = useRef(false)
  const { setConnectionStatus, handleStateUpdate, handleGameStarted, handleGameOver } = useGameStore()

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const s = getSocket()

    s.on('connect', () => {
      setConnectionStatus('connected')

      // Auth token
      const raw = localStorage.getItem('bunker_auth')
      if (raw) {
        try {
          const { token } = JSON.parse(raw)
          s.emit('authenticate', { token })
        } catch {}
      }

      // Підхоплюємо сесію якщо нас редіректнули з головного лобі
      // або якщо повернулись після перезавантаження сторінки
      const sessionRaw = localStorage.getItem(SESSION_KEY)
      if (sessionRaw) {
        try {
          const { code, playerIndex, playerName } = JSON.parse(sessionRaw)
          if (!code) return
          s.emit('rejoin', { code, playerIndex, playerName }, (res: {
            success?: boolean; error?: string; started?: boolean
            state?: Record<string, unknown>; players?: string[]
          }) => {
            if (res.error || !res.success) {
              localStorage.removeItem(SESSION_KEY)
              return
            }
            const store = useGameStore.getState()
            store.setMyName(playerName)
            if (res.started && res.state) {
              store.setRoom(code, playerIndex, [])
              store.handleGameStarted(res.state as unknown as Parameters<typeof store.handleGameStarted>[0])
            } else if (!res.started && res.players) {
              store.setRoom(code, playerIndex, res.players)
            }
          })
        } catch {}
      }
    })

    s.on('disconnect', () => setConnectionStatus('disconnected'))

    s.on('lobbyUpdate', ({ players, bots }: { players: string[]; bots?: boolean[] }) => {
      useGameStore.getState().setRoomPlayers(players, bots)
    })

    s.on('stateUpdate', ({ state }) => handleStateUpdate(state))

    s.on('gameStarted', ({ state, myPlayerIndex }) => {
      if (myPlayerIndex !== undefined) {
        useGameStore.getState().setRoom(
          useGameStore.getState().roomCode,
          myPlayerIndex,
          useGameStore.getState().roomPlayers,
        )
      }
      handleGameStarted(state)
    })

    s.on('gameOver',    ({ state }) => handleGameOver(state))
    s.on('roomClosed',  () => useGameStore.getState().reset())
    s.on('kicked',      () => useGameStore.getState().reset())

    s.on('error', (msg: string) => {
      useGameStore.getState().setError(typeof msg === 'string' ? msg : 'Помилка сервера')
    })

    s.on('chatMessage', ({ name, text, color }: { name: string; text: string; color: string }) => {
      useGameStore.getState().addChatMessage({ name, text, color })
    })

  }, [setConnectionStatus, handleStateUpdate, handleGameStarted, handleGameOver])

  return getSocket()
}
