import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useGameStore } from '../store/gameStore'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      // polling як fallback — критично для мобільних після сну
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    })
  }
  return socket
}

const SESSION_KEY = 'monopolia_session'

function doRejoin(s: Socket) {
  const sessionRaw = localStorage.getItem(SESSION_KEY)
  if (!sessionRaw) {
    // Сесії немає — якщо висимо на reconnecting, переходимо в лобі
    const store = useGameStore.getState()
    if (store.screen === 'reconnecting') store.setScreen('lobby')
    return
  }
  try {
    const { code, playerIndex, playerName } = JSON.parse(sessionRaw)
    if (!code) {
      localStorage.removeItem(SESSION_KEY)
      useGameStore.getState().setScreen('lobby')
      return
    }
    s.emit('rejoin', { code, playerIndex, playerName }, (res: {
      success?: boolean; error?: string; started?: boolean
      state?: Record<string, unknown>; players?: string[]; bots?: boolean[]
    }) => {
      if (res.error || !res.success) {
        localStorage.removeItem(SESSION_KEY)
        useGameStore.getState().setScreen('lobby')
        return
      }
      const store = useGameStore.getState()
      store.setMyName(playerName)
      if (res.started && res.state) {
        store.setRoom(code, playerIndex, [])
        store.handleGameStarted(res.state as unknown as Parameters<typeof store.handleGameStarted>[0])
      } else if (!res.started && res.players) {
        store.setRoom(code, playerIndex, res.players, res.bots)
      }
    })
  } catch {
    localStorage.removeItem(SESSION_KEY)
    useGameStore.getState().setScreen('lobby')
  }
}

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

      doRejoin(s)
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

    s.on('gameOver',   ({ state }) => handleGameOver(state))
    s.on('roomClosed', () => { if (!useGameStore.getState().leavingToHub) useGameStore.getState().reset() })
    s.on('kicked',     () => useGameStore.getState().reset())

    s.on('error', (msg: string) => {
      useGameStore.getState().setError(typeof msg === 'string' ? msg : 'Помилка сервера')
    })

    s.on('chatMessage', ({ name, text, color }: { name: string; text: string; color: string }) => {
      useGameStore.getState().addChatMessage({ name, text, color })
    })

    // Коли телефон розблоковується або вкладка стає активною —
    // примусово реконектимось якщо зв'язок впав
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !s.connected) {
        s.connect()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
    }

  }, [setConnectionStatus, handleStateUpdate, handleGameStarted, handleGameOver])

  return getSocket()
}
