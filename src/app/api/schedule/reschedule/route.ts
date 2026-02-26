export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { db } from "@/lib/db/connection"
import {
  divisions,
  groups,
  teams,
  teamConflicts,
  teamBlackoutDates,
  grounds,
  gameDays,
  timeSlots,
  matches,
} from "@/lib/db/schema"
import { eq, inArray, and, or, not } from "drizzle-orm"
import { reschedule } from "@/lib/scheduler/reschedule"
import type { TeamConflict, SlotRef, TeamBlackout } from "@/lib/scheduler/types"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tournamentId } = body as { tournamentId: number }

    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId is required" },
        { status: 400 }
      )
    }

    // 1. Load all divisions for this tournament
    const divisionRows = await db
      .select()
      .from(divisions)
      .where(eq(divisions.tournamentId, tournamentId))

    if (divisionRows.length === 0) {
      return NextResponse.json(
        { error: "No divisions found for this tournament" },
        { status: 404 }
      )
    }

    const divisionIds = divisionRows.map((d) => d.id)

    // 2. Load all groups through divisions
    const groupRows = await db
      .select()
      .from(groups)
      .where(inArray(groups.divisionId, divisionIds))

    if (groupRows.length === 0) {
      return NextResponse.json(
        { error: "No groups found for this tournament" },
        { status: 404 }
      )
    }

    const groupIds = groupRows.map((g) => g.id)
    const groupMap = new Map(groupRows.map((g) => [g.id, g]))

    // 3. Load all grounds, gameDays, timeSlots for this tournament
    const groundRows = await db
      .select()
      .from(grounds)
      .where(eq(grounds.tournamentId, tournamentId))

    const gameDayRows = await db
      .select()
      .from(gameDays)
      .where(eq(gameDays.tournamentId, tournamentId))

    const gameDayIds = gameDayRows.map((gd) => gd.id)

    let timeSlotRows: Array<{
      id: number
      gameDayId: number
      groundId: number
      startTime: string
      slotIndex: number
    }> = []
    if (gameDayIds.length > 0) {
      timeSlotRows = await db
        .select()
        .from(timeSlots)
        .where(inArray(timeSlots.gameDayId, gameDayIds))
    }

    // 4. Build SlotRef array
    const groundMapById = new Map(groundRows.map((g) => [g.id, g]))
    const gameDayMap = new Map(gameDayRows.map((gd) => [gd.id, gd]))

    const slotRefs: SlotRef[] = []
    for (const ts of timeSlotRows) {
      const ground = groundMapById.get(ts.groundId)
      const gameDay = gameDayMap.get(ts.gameDayId)
      if (!ground || !gameDay) continue
      slotRefs.push({
        id: ts.id,
        date: gameDay.date,
        groundFormat: ground.format,
        groundId: ts.groundId,
        startTime: ts.startTime,
      })
    }

    // 5. Load all team conflicts for teams in this tournament
    const allTeamRows = await db
      .select()
      .from(teams)
      .where(inArray(teams.groupId, groupIds))
    const allTeamIds = allTeamRows.map((t) => t.id)

    let conflictRows: TeamConflict[] = []
    if (allTeamIds.length > 0) {
      const rawConflicts = await db
        .select()
        .from(teamConflicts)
        .where(
          or(
            inArray(teamConflicts.teamAId, allTeamIds),
            inArray(teamConflicts.teamBId, allTeamIds)
          )
        )
      conflictRows = rawConflicts.map((c) => ({
        teamAId: c.teamAId,
        teamBId: c.teamBId,
        level: c.level,
      }))
    }

    // 6. Load team blackout dates
    let blackoutRows: TeamBlackout[] = []
    if (allTeamIds.length > 0) {
      const rawBlackouts = await db
        .select()
        .from(teamBlackoutDates)
        .where(inArray(teamBlackoutDates.teamId, allTeamIds))
      blackoutRows = rawBlackouts.map((b) => ({
        teamId: b.teamId,
        date: b.date,
      }))
    }

    // 7. Load all group-stage matches for this tournament
    const existingMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          inArray(matches.groupId, groupIds),
          eq(matches.stage, "group")
        )
      )

    // 7. Build allMatches array for reschedule input
    const allMatches = existingMatches.map((m) => {
      const group = groupMap.get(m.groupId!)
      return {
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        groupId: m.groupId!,
        format: group?.format ?? "leather",
        isLocked: m.isLocked,
        status: m.status,
        timeSlotId: m.timeSlotId ?? undefined,
        umpireTeam1Id: m.umpireTeam1Id ?? undefined,
        umpireTeam2Id: m.umpireTeam2Id ?? undefined,
      }
    })

    // 8. Build teamFormatMap: teamId → format (from group)
    const groupFormatMap = new Map(groupRows.map((g) => [g.id, g.format]))
    const teamFormatMap = new Map<number, string>()
    for (const t of allTeamRows) {
      const format = groupFormatMap.get(t.groupId)
      if (format) teamFormatMap.set(t.id, format)
    }

    // 9. Call reschedule()
    const result = reschedule({
      allMatches,
      slots: slotRefs,
      conflicts: conflictRows,
      blackouts: blackoutRows,
      divisionTeamIds: allTeamIds,
      teamFormatMap,
    })

    // 9. If result has message (no eligible matches), return it
    if (result.message) {
      return NextResponse.json({
        scheduled: 0,
        unschedulable: [],
        message: result.message,
      })
    }

    // 10. Delete existing non-locked, non-played group matches from DB
    const matchIdsToDelete = existingMatches
      .filter((m) => !m.isLocked && m.status !== "played")
      .map((m) => m.id)

    if (matchIdsToDelete.length > 0) {
      await db
        .delete(matches)
        .where(inArray(matches.id, matchIdsToDelete))
    }

    // 11. Insert newly scheduled matches
    let insertedCount = 0
    for (const sm of result.scheduled) {
      await db.insert(matches).values({
        groupId: sm.groupId,
        teamAId: sm.teamAId,
        teamBId: sm.teamBId,
        timeSlotId: sm.timeSlotId,
        stage: "group",
        umpireTeam1Id: sm.umpireTeam1Id,
      })
      insertedCount++
    }

    // 12. Return result
    return NextResponse.json({
      scheduled: insertedCount,
      unschedulable: result.unschedulable,
      ...(result.message ? { message: result.message } : {}),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
