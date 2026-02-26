"use server"

import { db } from "@/lib/db/connection"
import {
  matches,
  timeSlots,
  grounds,
  gameDays,
  groups,
  divisions,
  teams,
  teamConflicts,
} from "@/lib/db/schema"
import { eq, and, or, inArray } from "drizzle-orm"
import { moveMatch, toggleLock } from "@/lib/scheduler/match-ops"
import { buildOccupancyMap } from "@/lib/scheduler/constraints"
import type { SlotRef, TeamConflict } from "@/lib/scheduler/types"

export async function moveMatchAction(
  matchId: number,
  newSlotId: number,
  overrideConflict?: boolean
) {
  // Load match
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))

  if (!match) {
    return { error: "Match not found" }
  }

  // Load the new slot with ground format and game day date to build SlotRef
  const [slotRow] = await db
    .select({
      id: timeSlots.id,
      groundFormat: grounds.format,
      date: gameDays.date,
    })
    .from(timeSlots)
    .innerJoin(grounds, eq(timeSlots.groundId, grounds.id))
    .innerJoin(gameDays, eq(timeSlots.gameDayId, gameDays.id))
    .where(eq(timeSlots.id, newSlotId))

  if (!slotRow) {
    return { error: "Time slot not found" }
  }

  const newSlot: SlotRef = {
    id: slotRow.id,
    date: slotRow.date,
    groundFormat: slotRow.groundFormat,
    groundId: 0,
    startTime: "",
  }

  // Load group to get format
  const [group] = match.groupId
    ? await db.select().from(groups).where(eq(groups.id, match.groupId))
    : [null]

  const format = group?.format ?? "leather"

  // Build MatchRecord for the scheduler
  const matchRecord = {
    id: match.id,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    timeSlotId: match.timeSlotId,
    isLocked: match.isLocked,
    status: match.status,
    conflictOverride: match.conflictOverride,
    format,
    groupId: match.groupId ?? 0,
  }

  // Find the tournament through group → division → tournament to scope occupancy
  let tournamentId: number | null = null
  if (group) {
    const [div] = await db
      .select()
      .from(divisions)
      .where(eq(divisions.id, group.divisionId))
    if (div) tournamentId = div.tournamentId
  }

  // Build occupancy from all matches in the same tournament (exclude current match)
  let occupancyMatches: Array<{
    timeSlotId: number
    teamAId: number
    teamBId: number
    umpireTeam1Id?: number
    umpireTeam2Id?: number
  }> = []

  if (tournamentId) {
    const divRows = await db
      .select({ id: divisions.id })
      .from(divisions)
      .where(eq(divisions.tournamentId, tournamentId))
    const divIds = divRows.map((d) => d.id)

    let groupIds: number[] = []
    if (divIds.length > 0) {
      const groupRows = await db
        .select({ id: groups.id })
        .from(groups)
        .where(inArray(groups.divisionId, divIds))
      groupIds = groupRows.map((g) => g.id)
    }

    if (groupIds.length > 0) {
      const allMatches = await db
        .select()
        .from(matches)
        .where(
          and(
            inArray(matches.groupId, groupIds),
            eq(matches.status, "scheduled")
          )
        )

      occupancyMatches = allMatches
        .filter((m) => m.id !== matchId && m.timeSlotId !== null)
        .map((m) => ({
          timeSlotId: m.timeSlotId!,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          umpireTeam1Id: m.umpireTeam1Id ?? undefined,
          umpireTeam2Id: m.umpireTeam2Id ?? undefined,
        }))
    }
  }

  const occupancy = buildOccupancyMap(occupancyMatches)

  // Load conflicts
  const allTeamIds = [match.teamAId, match.teamBId]
  const rawConflicts = await db
    .select()
    .from(teamConflicts)
    .where(
      or(
        inArray(teamConflicts.teamAId, allTeamIds),
        inArray(teamConflicts.teamBId, allTeamIds)
      )
    )
  const conflicts: TeamConflict[] = rawConflicts.map((c) => ({
    teamAId: c.teamAId,
    teamBId: c.teamBId,
    level: c.level,
  }))

  // Call moveMatch from scheduler
  const result = moveMatch(
    matchRecord,
    newSlot,
    occupancy,
    conflicts,
    overrideConflict
  )

  if (!result.success) {
    return { error: result.error, conflict: result.conflict }
  }

  // Update match in DB: set new timeSlotId, record override if applicable
  await db
    .update(matches)
    .set({
      timeSlotId: newSlotId,
      ...(overrideConflict && result.success
        ? {
            conflictOverride: JSON.stringify({
              reason: `Override confirmed for slot ${newSlotId}`,
              timestamp: new Date().toISOString(),
            }),
          }
        : {}),
    })
    .where(eq(matches.id, matchId))

  const [updated] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))

  return { data: updated }
}

export async function toggleLockAction(matchId: number) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))

  if (!match) {
    return { error: "Match not found" }
  }

  const result = toggleLock({
    isLocked: match.isLocked,
    status: match.status,
  })

  if (!result.success) {
    return { error: result.error }
  }

  await db
    .update(matches)
    .set({ isLocked: result.newLockState })
    .where(eq(matches.id, matchId))

  const [updated] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))

  return { data: updated }
}

export async function enterResultAction(
  matchId: number,
  teamAScore: number,
  teamBScore: number,
  winnerId: number | null
) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))

  if (!match) {
    return { error: "Match not found" }
  }

  if (match.status === "played") {
    return { error: "Match result already entered" }
  }

  // Validate winnerId if provided
  if (
    winnerId !== null &&
    winnerId !== match.teamAId &&
    winnerId !== match.teamBId
  ) {
    return { error: "Winner must be one of the playing teams" }
  }

  await db
    .update(matches)
    .set({
      teamAScore,
      teamBScore,
      winnerId,
      status: "played",
    })
    .where(eq(matches.id, matchId))

  const [updated] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))

  return { data: updated }
}

export async function getMatch(matchId: number) {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))

  if (!match) {
    return { error: "Match not found" }
  }

  return { data: match }
}

export async function listMatches(filters: {
  groupId?: number
  tournamentId?: number
  stage?: string
}) {
  // No filters — return all
  if (!filters.groupId && !filters.tournamentId && !filters.stage) {
    const result = await db.select().from(matches)
    return { data: result }
  }

  // Build conditions
  const conditions = []

  if (filters.groupId) {
    conditions.push(eq(matches.groupId, filters.groupId))
  }

  if (filters.stage) {
    conditions.push(eq(matches.stage, filters.stage as "group" | "knockout"))
  }

  if (filters.tournamentId) {
    // Need to resolve groupIds through divisions
    const divRows = await db
      .select({ id: divisions.id })
      .from(divisions)
      .where(eq(divisions.tournamentId, filters.tournamentId))
    const divIds = divRows.map((d) => d.id)

    if (divIds.length === 0) {
      return { data: [] }
    }

    const groupRows = await db
      .select({ id: groups.id })
      .from(groups)
      .where(inArray(groups.divisionId, divIds))
    const groupIds = groupRows.map((g) => g.id)

    if (groupIds.length === 0) {
      return { data: [] }
    }

    conditions.push(inArray(matches.groupId, groupIds))
  }

  const result = await db
    .select()
    .from(matches)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))

  return { data: result }
}

export async function clearSchedule(tournamentId: number) {
  const divRows = await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(eq(divisions.tournamentId, tournamentId))
  const divIds = divRows.map((d) => d.id)

  if (divIds.length === 0) return { deleted: 0 }

  const groupRows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(inArray(groups.divisionId, divIds))
  const groupIds = groupRows.map((g) => g.id)

  if (groupIds.length === 0) return { deleted: 0 }

  const result = await db
    .delete(matches)
    .where(inArray(matches.groupId, groupIds))

  return { deleted: result.changes ?? 0 }
}
