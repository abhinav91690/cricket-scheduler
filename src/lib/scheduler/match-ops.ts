import type { TeamConflict, SlotRef, OccupancyMap } from "./types"
import { isFormatCompatible, hasTeamConflictInSlot, isTeamAvailable } from "./constraints"

export interface MatchRecord {
  id: number
  teamAId: number
  teamBId: number
  timeSlotId: number | null
  isLocked: boolean
  status: string
  conflictOverride: string | null
  format: string
  groupId: number
}

export interface MoveResult {
  success: boolean
  conflict?: string
  error?: string
}

/**
 * Validates whether a match can be moved to a new slot, checking
 * lock status, played status, format compatibility, team availability,
 * and team conflicts.
 */
export function moveMatch(
  match: MatchRecord,
  newSlot: SlotRef,
  occupancy: OccupancyMap,
  conflicts: TeamConflict[],
  overrideConflict?: boolean
): MoveResult {
  if (match.isLocked) {
    return { success: false, error: "Match is locked" }
  }

  if (match.status === "played") {
    return { success: false, error: "Match is already played" }
  }

  const matchRef = {
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    groupId: match.groupId,
    format: match.format,
  }

  if (!isFormatCompatible(newSlot, matchRef)) {
    return { success: false, error: `Slot format "${newSlot.groundFormat}" is incompatible with match format "${match.format}"` }
  }

  if (!isTeamAvailable(newSlot.id, matchRef, occupancy)) {
    const description = `Team is already playing in slot ${newSlot.id}`
    if (overrideConflict) {
      return { success: true }
    }
    return { success: false, conflict: description }
  }

  if (hasTeamConflictInSlot(newSlot.id, matchRef, occupancy, conflicts)) {
    const description = `Team conflict detected in slot ${newSlot.id}`
    if (overrideConflict) {
      return { success: true }
    }
    return { success: false, conflict: description }
  }

  return { success: true }
}

/**
 * Toggles the lock state of a match. Rejects if the match is already played.
 */
export function toggleLock(
  match: { isLocked: boolean; status: string }
): { success: boolean; newLockState: boolean; error?: string } {
  if (match.status === "played") {
    return { success: false, newLockState: match.isLocked, error: "Cannot toggle lock on a played match" }
  }

  return { success: true, newLockState: !match.isLocked }
}
