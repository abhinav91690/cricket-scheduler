import { generateGroupSchedule, type ExistingMatch, type ScheduleResult } from "./group-schedule"
import type { TeamConflict, SlotRef, MatchRef, TeamBlackout } from "./types"

export interface RescheduleInput {
  allMatches: Array<
    MatchRef & {
      isLocked: boolean
      status: string
      timeSlotId?: number
      teamAId: number
      teamBId: number
      umpireTeam1Id?: number
      umpireTeam2Id?: number
    }
  >
  slots: SlotRef[]
  conflicts: TeamConflict[]
  blackouts: TeamBlackout[]
  divisionTeamIds: number[]
  teamFormatMap?: Map<number, string>
}

export function reschedule(input: RescheduleInput): ScheduleResult & { message?: string } {
  const { allMatches, slots, conflicts, blackouts, divisionTeamIds, teamFormatMap } = input

  // 1. Separate locked/played matches (preserve them as existingSchedule)
  const preserved = allMatches.filter((m) => m.isLocked || m.status === "played")

  // 2. Collect non-locked, non-played matches as the ones to reschedule
  const eligible = allMatches.filter((m) => !m.isLocked && m.status !== "played")

  // 3. If no eligible matches, return empty result with message
  if (eligible.length === 0) {
    return {
      scheduled: [],
      unschedulable: [],
      message: "No matches eligible for re-scheduling",
    }
  }

  // 4. Build existingSchedule from preserved matches (only those with slot assignments)
  const existingSchedule: ExistingMatch[] = preserved
    .filter((m) => m.timeSlotId != null)
    .map((m) => ({
      timeSlotId: m.timeSlotId!,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      umpireTeam1Id: m.umpireTeam1Id,
      umpireTeam2Id: m.umpireTeam2Id,
    }))

  // 5. Clear slot assignments — eligible matches become unscheduled MatchRefs
  const matchesToSchedule: MatchRef[] = eligible.map((m) => ({
    teamAId: m.teamAId,
    teamBId: m.teamBId,
    groupId: m.groupId,
    format: m.format,
  }))

  // 6. Call generateGroupSchedule with eligible matches and preserved as existingSchedule
  return generateGroupSchedule({
    matches: matchesToSchedule,
    slots,
    conflicts,
    blackouts,
    existingSchedule,
    divisionTeamIds,
    teamFormatMap,
  })
}
