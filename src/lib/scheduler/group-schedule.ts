import type { TeamConflict, SlotRef, MatchRef, OccupancyMap, TeamBlackout } from "./types"
import {
  isFormatCompatible,
  hasTeamConflictInSlot,
  hasTeamConflictOnDay,
  isTeamAvailable,
  isSlotOccupied,
  hasTeamPlayedThisWeekend,
  isTeamBlackedOut,
  buildOccupancyMap,
  sortByConstraintDifficulty,
} from "./constraints"
import { scoreSlot } from "./scoring"
import type { ScoreContext } from "./scoring"
import { selectUmpireTeam } from "./umpire"

export interface ExistingMatch {
  timeSlotId: number
  teamAId: number
  teamBId: number
  umpireTeam1Id?: number
  umpireTeam2Id?: number
}

export interface ScheduleInput {
  matches: MatchRef[]
  slots: SlotRef[]
  conflicts: TeamConflict[]
  blackouts: TeamBlackout[]
  existingSchedule: ExistingMatch[]
  divisionTeamIds: number[]
  /** Map of teamId → format (e.g. "leather" or "tape_ball") for format-aware umpire selection */
  teamFormatMap?: Map<number, string>
}

export interface ScheduledMatch extends MatchRef {
  timeSlotId: number
  umpireTeam1Id: number | null
}

export interface ScheduleResult {
  scheduled: ScheduledMatch[]
  unschedulable: Array<MatchRef & { reason: string }>
}

/** Helper to increment a nested count map: outer → inner → count */
function incrementNestedCount<K>(
  map: Map<number, Map<K, number>>,
  teamId: number,
  key: K
): void {
  if (!map.has(teamId)) {
    map.set(teamId, new Map())
  }
  const inner = map.get(teamId)!
  inner.set(key, (inner.get(key) ?? 0) + 1)
}

export function generateGroupSchedule(input: ScheduleInput): ScheduleResult {
  const { matches, slots, conflicts, blackouts, existingSchedule, divisionTeamIds, teamFormatMap } = input

  const scheduled: ScheduledMatch[] = []
  const unschedulable: Array<MatchRef & { reason: string }> = []

  // Build a slot lookup for quick access
  const slotMap = new Map(slots.map((s) => [s.id, s]))

  // 1. Sort matches by constraint difficulty (most-constrained first)
  const sortedMatches = sortByConstraintDifficulty(matches, conflicts)

  // 2. Build occupancy map from existing schedule
  const occupancy = buildOccupancyMap(existingSchedule)

  // 3. Build umpire counts from existing schedule
  const umpireCounts = new Map<number, number>()
  for (const em of existingSchedule) {
    if (em.umpireTeam1Id != null) {
      umpireCounts.set(em.umpireTeam1Id, (umpireCounts.get(em.umpireTeam1Id) ?? 0) + 1)
    }
    if (em.umpireTeam2Id != null) {
      umpireCounts.set(em.umpireTeam2Id, (umpireCounts.get(em.umpireTeam2Id) ?? 0) + 1)
    }
  }

  // 4. Build tracking maps from existing schedule
  const teamDayCounts = new Map<number, Map<string, number>>()
  const teamGroundCounts = new Map<number, Map<number, number>>()
  const teamTimeCounts = new Map<number, Map<string, number>>()

  for (const em of existingSchedule) {
    const emSlot = slotMap.get(em.timeSlotId)
    if (!emSlot) continue
    for (const teamId of [em.teamAId, em.teamBId]) {
      incrementNestedCount(teamDayCounts, teamId, emSlot.date)
      incrementNestedCount(teamGroundCounts, teamId, emSlot.groundId)
      incrementNestedCount(teamTimeCounts, teamId, emSlot.startTime)
    }
  }

  // 5. For each match, find best slot
  for (const match of sortedMatches) {
    const candidates = slots
      .filter((s) => isFormatCompatible(s, match))
      .filter((s) => !isSlotOccupied(s.id, occupancy))
      .filter((s) => isTeamAvailable(s.id, match, occupancy))
      .filter((s) => !hasTeamConflictInSlot(s.id, match, occupancy, conflicts))
      .filter((s) => !hasTeamConflictOnDay(s.date, match, occupancy, slots, conflicts))
      .filter((s) => !hasTeamPlayedThisWeekend(s.date, match, occupancy, slots))
      .filter((s) => !isTeamBlackedOut(s.date, match, blackouts))

    if (candidates.length === 0) {
      unschedulable.push({
        ...match,
        reason: "No compatible slot available: all slots failed format, availability, or conflict constraints",
      })
      continue
    }

    // Build score context
    const ctx: ScoreContext = {
      teamDayCounts,
      umpireCounts,
      occupancy,
      allSlots: slots,
      teamGroundCounts,
      teamTimeCounts,
    }

    // Score remaining slots, pick lowest
    const scored = candidates.map((s) => ({
      slot: s,
      score: scoreSlot(s, match, ctx),
    }))
    scored.sort((a, b) => a.score - b.score)
    const bestSlot = scored[0].slot

    // Select umpire team
    const umpireTeam1Id = selectUmpireTeam(
      bestSlot.id,
      match,
      occupancy,
      umpireCounts,
      conflicts,
      divisionTeamIds,
      match.format,
      teamFormatMap
    )

    const scheduledMatch: ScheduledMatch = {
      ...match,
      timeSlotId: bestSlot.id,
      umpireTeam1Id,
    }
    scheduled.push(scheduledMatch)

    // Update occupancy
    if (!occupancy.has(bestSlot.id)) {
      occupancy.set(bestSlot.id, [])
    }
    const slotTeams = occupancy.get(bestSlot.id)!
    slotTeams.push(match.teamAId, match.teamBId)
    if (umpireTeam1Id != null) {
      slotTeams.push(umpireTeam1Id)
    }

    // Update umpire counts
    if (umpireTeam1Id != null) {
      umpireCounts.set(umpireTeam1Id, (umpireCounts.get(umpireTeam1Id) ?? 0) + 1)
    }

    // Update all tracking maps
    for (const teamId of [match.teamAId, match.teamBId]) {
      incrementNestedCount(teamDayCounts, teamId, bestSlot.date)
      incrementNestedCount(teamGroundCounts, teamId, bestSlot.groundId)
      incrementNestedCount(teamTimeCounts, teamId, bestSlot.startTime)
    }
  }

  return { scheduled, unschedulable }
}
