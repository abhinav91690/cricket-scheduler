export type TeamConflict = {
  teamAId: number
  teamBId: number
  level: "same_slot" | "same_day"
}

export type SlotRef = {
  id: number
  date: string
  groundFormat: string
  groundId: number
  startTime: string
}

export type MatchRef = {
  teamAId: number
  teamBId: number
  groupId: number
  format: string
}

/** slotId → team IDs occupying that slot (playing + umpiring) */
export type OccupancyMap = Map<number, number[]>

export type TeamBlackout = {
  teamId: number
  date: string
}

