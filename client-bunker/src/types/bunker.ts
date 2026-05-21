export type Phase =
  | 'lobby'
  | 'scenario_pick'
  | 'game_start'
  | 'round_reveal'
  | 'discussion'
  | 'voting'
  | 'voting_result'
  | 'end_game'

export interface Attribute {
  value: string
  isRevealed: boolean
}

export interface Attributes {
  profession: Attribute
  biology:    Attribute
  health:     Attribute
  hobby:      Attribute
  trait:      Attribute
  baggage:    Attribute
}

export interface ActionCard {
  id:   string
  name: string
  desc?: string   // тільки свої карти
  used: boolean
}

export interface BunkerPlayer {
  id:             number
  name:           string
  isAlive:        boolean
  isSilenced:     boolean
  immunityRounds: number
  hasRevealed:    boolean
  attributes:     Attributes
  actionCards:    ActionCard[]
}

export interface Scenario {
  id:       number
  title:    string
  subtitle: string
  disaster: string
  bunker:   string
  goal:     string
  emoji:    string
}

export interface BunkerState {
  gameType:       'bunker'
  phase:          Phase
  round:          number
  bunkerCapacity: number
  scenario:       Scenario
  timeDeadline:   number | null
  myId:           number
  players:        BunkerPlayer[]
  votes:          Record<number, number>   // voterIdx → targetIdx
  log:            string[]
  winner:         number[] | null
  epilogue:       string | null
}

// Socket events client → server
export interface ClientEvents {
  authenticate:         (data: { token: string }) => void
  createRoom:           (data: { playerName: string; gameType: 'bunker' }, cb: (res: { code: string; playerIndex: number; error?: string }) => void) => void
  joinRoom:             (data: { code: string; playerName: string }, cb: (res: { code: string; playerIndex: number; error?: string }) => void) => void
  startGame:            (settings: { scenarioId?: number }) => void
  action:               (data: { type: BunkerAction; data: Record<string, unknown> }) => void
  chatMessage:          (data: { text: string; name: string; icon: string; color: string }) => void
  leaveRoom:            () => void
}

export type BunkerAction =
  | 'b_selectScenario'   // хост обирає сценарій
  | 'b_revealAttr'       // гравець розкриває атрибут
  | 'b_vote'             // голос проти гравця
  | 'b_useCard'          // застосувати карту дії
  | 'b_ready'            // підтвердити готовність (game_start)
