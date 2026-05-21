import { create } from 'zustand'
import type { BunkerState } from '../types/bunker'

export type Screen = 'auth' | 'lobby' | 'waiting' | 'game'

interface ChatMessage {
  name:  string
  text:  string
  color: string
  ts:    number
}

interface LocalMarkers {
  [playerIdx: number]: '🟢' | '🔴' | null
}

interface GameStore {
  screen:           Screen
  myName:           string
  myIndex:          number | null
  roomCode:         string
  roomPlayers:      string[]
  isHost:           boolean
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
  gameState:        BunkerState | null
  chat:             ChatMessage[]
  localMarkers:     LocalMarkers   // клієнтські мітки 🟢🔴 — тільки локально

  // Actions
  setScreen:            (s: Screen) => void
  setMyName:            (n: string) => void
  setRoom:              (code: string, myIndex: number, players: string[]) => void
  setRoomPlayers:       (players: string[], gameType?: string) => void
  setConnectionStatus:  (s: 'connected' | 'disconnected' | 'reconnecting') => void
  handleStateUpdate:    (state: BunkerState) => void
  handleGameStarted:    (state: BunkerState) => void
  handleGameOver:       (state: BunkerState) => void
  addChatMessage:       (msg: Omit<ChatMessage, 'ts'>) => void
  setLocalMarker:       (playerIdx: number, marker: '🟢' | '🔴' | null) => void
  reset:                () => void
}

export const useGameStore = create<GameStore>((set) => ({
  screen:           'lobby',
  myName:           localStorage.getItem('bunker_name') || '',
  myIndex:          null,
  roomCode:         '',
  roomPlayers:      [],
  isHost:           false,
  connectionStatus: 'disconnected',
  gameState:        null,
  chat:             [],
  localMarkers:     {},

  setScreen:  (screen) => set({ screen }),
  setMyName:  (myName) => {
    localStorage.setItem('bunker_name', myName)
    set({ myName })
  },

  setRoom: (roomCode, myIndex, roomPlayers) => set({
    roomCode,
    myIndex,
    roomPlayers,
    isHost: myIndex === 0,
    screen: 'waiting',
  }),

  setRoomPlayers: (roomPlayers) => set({ roomPlayers }),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  handleStateUpdate: (state) => set((s) => ({
    gameState: state,
    // оновлюємо myIndex якщо він ще не встановлений (після rejoin)
    myIndex: s.myIndex ?? state.myId,
  })),

  handleGameStarted: (state) => set({
    gameState: state,
    myIndex:   state.myId,   // сервер надсилає myId у стейті
    screen:    'game',
  }),

  handleGameOver: (state) => set({ gameState: state }),

  addChatMessage: (msg) => set((s) => ({
    chat: [...s.chat.slice(-99), { ...msg, ts: Date.now() }],
  })),

  setLocalMarker: (playerIdx, marker) => set((s) => ({
    localMarkers: { ...s.localMarkers, [playerIdx]: marker },
  })),

  reset: () => set({
    screen:      'lobby',
    myIndex:     null,
    roomCode:    '',
    roomPlayers: [],
    isHost:      false,
    gameState:   null,
    chat:        [],
    localMarkers:{},
  }),
}))
