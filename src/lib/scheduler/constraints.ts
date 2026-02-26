import type { TeamConflict, SlotRef, MatchRef, OccupancyMap, TeamBlackout } from "./types"

/**
 * Checks if a slot's ground format matches the match's required format.
 */
export function isFormatCompatible(slot: SlotRef, match: MatchRef): boolean {
  return slot.groundFormat === match.format
}

/**
 * Checks if placing a match in a slot would violate any "same_slot" team conflicts.
 * Returns true if any team already in the slot has a same_slot conflict with either playing team.
 */
export function hasTeamConflictInSlot(
  slotId: number,
  match: MatchRef,
  occupancy: OccupancyMap,
  conflicts: TeamConflict[]
): boolean {
  const teamsInSlot = occupancy.get(slotId) ?? []
  if (teamsInSlot.length === 0) return false

  const matchTeams = [match.teamAId, match.teamBId]

  for (const conflict of conflicts) {
    if (conflict.level !== "same_slot") continue

    for (const matchTeam of matchTeams) {
      // Determine the "other" team in the conflict pair
      let otherTeam: number | null = null
      if (conflict.teamAId === matchTeam) {
        otherTeam = conflict.teamBId
      } else if (conflict.teamBId === matchTeam) {
        otherTeam = conflict.teamAId
      }

      if (otherTeam !== null && teamsInSlot.includes(otherTeam)) {
        return true
      }
    }
  }

  return false
}

/**
 * Checks if placing a match on a given day would violate any "same_day" team conflicts.
 * Returns true if any team playing on that day has a same_day conflict with either playing team.
 */
export function hasTeamConflictOnDay(
  date: string,
  match: MatchRef,
  occupancy: OccupancyMap,
  allSlots: SlotRef[],
  conflicts: TeamConflict[]
): boolean {
  // Collect all team IDs playing on this date
  const teamsOnDay = new Set<number>()
  for (const slot of allSlots) {
    if (slot.date === date) {
      const teams = occupancy.get(slot.id) ?? []
      for (const teamId of teams) {
        teamsOnDay.add(teamId)
      }
    }
  }

  if (teamsOnDay.size === 0) return false

  const matchTeams = [match.teamAId, match.teamBId]

  for (const conflict of conflicts) {
    if (conflict.level !== "same_day") continue

    for (const matchTeam of matchTeams) {
      let otherTeam: number | null = null
      if (conflict.teamAId === matchTeam) {
        otherTeam = conflict.teamBId
      } else if (conflict.teamBId === matchTeam) {
        otherTeam = conflict.teamAId
      }

      if (otherTeam !== null && teamsOnDay.has(otherTeam)) {
        return true
      }
    }
  }

  return false
}

/**
 * Checks if neither playing team is already occupying the given slot.
 */
export function isTeamAvailable(
  slotId: number,
  match: MatchRef,
  occupancy: OccupancyMap
): boolean {
  const teamsInSlot = occupancy.get(slotId) ?? []
  return !teamsInSlot.includes(match.teamAId) && !teamsInSlot.includes(match.teamBId)
}
/**
 * Checks if a slot already has a match assigned to it.
 * Each time slot can hold exactly one match.
 */
export function isSlotOccupied(
  slotId: number,
  occupancy: OccupancyMap
): boolean {
  const teamsInSlot = occupancy.get(slotId) ?? []
  return teamsInSlot.length > 0
}

/**
 * Returns a key identifying which weekend a date belongs to.
 * Saturday and Sunday of the same weekend return the Saturday date.
 * Weekdays return the date itself (no grouping).
 */
export function getWeekendKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const day = d.getUTCDay() // 0=Sun, 6=Sat
  if (day === 0) {
    // Sunday → go back 1 day to Saturday
    const sat = new Date(d)
    sat.setUTCDate(sat.getUTCDate() - 1)
    return sat.toISOString().slice(0, 10)
  }
  if (day === 6) {
    // Saturday → already the key
    return dateStr
  }
  // Weekday → no grouping, return as-is
  return dateStr
}

/**
 * Checks if either team in the match already has a game scheduled
 * on any date in the same weekend (Saturday-Sunday pair).
 * Returns true if a team would play more than once in the same weekend.
 */
export function hasTeamPlayedThisWeekend(
  date: string,
  match: MatchRef,
  occupancy: OccupancyMap,
  allSlots: SlotRef[]
): boolean {
  const targetKey = getWeekendKey(date)
  const matchTeams = [match.teamAId, match.teamBId]

  // Collect all team IDs playing on dates in the same weekend
  for (const slot of allSlots) {
    if (slot.date === date) continue // same date is handled by isTeamAvailable
    if (getWeekendKey(slot.date) !== targetKey) continue

    const teamsInSlot = occupancy.get(slot.id) ?? []
    for (const teamId of matchTeams) {
      if (teamsInSlot.includes(teamId)) {
        return true
      }
    }
  }

  return false
}

/**
 * Checks if either team in the match has a blackout on the given date.
 * Returns true if the match cannot be played on this date.
 */
export function isTeamBlackedOut(
  date: string,
  match: MatchRef,
  blackouts: TeamBlackout[]
): boolean {
  for (const b of blackouts) {
    if (b.date === date && (b.teamId === match.teamAId || b.teamId === match.teamBId)) {
      return true
    }
  }
  return false
}




/**
 * Builds an occupancy map (slotId → team IDs) from existing matches.
 * Includes playing teams and umpire teams.
 */
export function buildOccupancyMap(
  existingMatches: Array<{
    timeSlotId: number
    teamAId: number
    teamBId: number
    umpireTeam1Id?: number
    umpireTeam2Id?: number
  }>
): OccupancyMap {
  const occupancy: OccupancyMap = new Map()

  for (const match of existingMatches) {
    const slotId = match.timeSlotId
    if (!occupancy.has(slotId)) {
      occupancy.set(slotId, [])
    }
    const teams = occupancy.get(slotId)!
    teams.push(match.teamAId, match.teamBId)
    if (match.umpireTeam1Id != null) {
      teams.push(match.umpireTeam1Id)
    }
    if (match.umpireTeam2Id != null) {
      teams.push(match.umpireTeam2Id)
    }
  }

  return occupancy
}

/**
 * Sorts matches by constraint difficulty — most-constrained first.
 * A match's difficulty = number of conflicts involving either playing team.
 */
export function sortByConstraintDifficulty(
  matches: MatchRef[],
  conflicts: TeamConflict[]
): MatchRef[] {
  function countConflicts(match: MatchRef): number {
    let count = 0
    for (const conflict of conflicts) {
      if (
        conflict.teamAId === match.teamAId ||
        conflict.teamBId === match.teamAId ||
        conflict.teamAId === match.teamBId ||
        conflict.teamBId === match.teamBId
      ) {
        count++
      }
    }
    return count
  }

  return [...matches].sort((a, b) => countConflicts(b) - countConflicts(a))
}
