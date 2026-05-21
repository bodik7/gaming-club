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

export function useSocket() {
  const initialized = useRef(false)
  const { setConnectionStatus, handleStateUpdate, handleGameStarted, handleGameOver } = useGameStore()

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const s = getSocket()

    s.on('connect', () => {
      setConnectionStatus('connected')
      // Надсилаємо токен якщо авторизовані
      const raw = localStorage.getItem('bunker_auth')
      if (raw) {
        try {
          const { token } = JSON.parse(raw)
          s.emit('authenticate', { token })
        } catch {}
      }
    })

    s.on('disconnect', () => setConnectionStatus('disconnected'))

    s.on('stateUpdate', ({ state })                      => handleStateUpdate(state))
    s.on('gameStarted', ({ state, myPlayerIndex })       => {
      if (myPlayerIndex !== undefined)
        useGameStore.getState().setRoom(
          useGameStore.getState().roomCode,
          myPlayerIndex,
          useGameStore.getState().roomPlayers,
        )
      handleGameStarted(state)
    })
    s.on('gameOver', ({ state }) => handleGameOver(state))

    s.on('chatMessage', ({ name, text, color }) => {
      useGameStore.getState().addChatMessage({ name, text, color })
    })

    return () => {
      // Не відключаємось при анмаунті — сокет живе весь час
    }
  }, [])

  return getSocket()
}
