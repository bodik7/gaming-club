import { create } from 'zustand'
import type { BunkerState } from '../types/bunker'

export type Screen = 'auth' | 'lobby' | 'waiting' | 'game' | 'reconnecting'

interface ChatMessage {
  name:  string
  text:  string
  color: string
  icon?: string
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
  roomBots:         boolean[]
  isHost:           boolean
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
  gameState:        BunkerState | null
  chat:             ChatMessage[]
  localMarkers:     LocalMarkers
  error:            string | null
  leavingToHub:     boolean

  // Actions
  setScreen:            (s: Screen) => void
  setMyName:            (n: string) => void
  setRoom:              (code: string, myIndex: number, players: string[], bots?: boolean[]) => void
  setRoomPlayers:       (players: string[], bots?: boolean[]) => void
  setConnectionStatus:  (s: 'connected' | 'disconnected' | 'reconnecting') => void
  handleStateUpdate:    (state: BunkerState) => void
  handleGameStarted:    (state: BunkerState) => void
  handleGameOver:       (state: BunkerState) => void
  addChatMessage:       (msg: Omit<ChatMessage, 'ts'>) => void
  setLocalMarker:       (playerIdx: number, marker: '🟢' | '🔴' | null) => void
  setError:             (msg: string | null) => void
  reset:                () => void
  setLeavingToHub:      () => void
}

export const useGameStore = create<GameStore>((set) => ({
  screen:           localStorage.getItem('monopolia_session') ? 'reconnecting' : 'lobby',
  myName:           localStorage.getItem('bunker_name') || '',
  myIndex:          null,
  roomCode:         '',
  roomPlayers:      [],
  roomBots:         [],
  isHost:           false,
  connectionStatus: 'disconnected',
  gameState:        null,
  chat:             [],
  localMarkers:     {},
  error:            null,
  leavingToHub:     false,

  setScreen:  (screen) => set({ screen }),
  setMyName:  (myName) => {
    localStorage.setItem('bunker_name', myName)
    set({ myName })
  },

  setRoom: (roomCode, myIndex, roomPlayers, bots) => set({
    roomCode,
    myIndex,
    roomPlayers,
    roomBots: bots || [],
    isHost: myIndex === 0,
    screen: 'waiting',
  }),

  setRoomPlayers: (roomPlayers, bots) => set({ roomPlayers, roomBots: bots || [] }),

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

  setError: (error) => {
    set({ error })
    if (error) setTimeout(() => useGameStore.getState().setError(null), 4000)
  },

  setLeavingToHub: () => set({ leavingToHub: true }),

  reset: () => set({
    screen:      'lobby',
    myIndex:     null,
    roomCode:    '',
    roomPlayers: [],
    roomBots:    [],
    isHost:      false,
    gameState:   null,
    chat:        [],
    localMarkers:{},
    error:       null,
  }),
}))
