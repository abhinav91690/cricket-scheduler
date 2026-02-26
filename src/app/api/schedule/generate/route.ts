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
import { eq, inArray, and, or } from "drizzle-orm"
import { generateRoundRobinPairings } from "@/lib/scheduler/round-robin"
import { generateGroupSchedule } from "@/lib/scheduler/group-schedule"
import type { MatchRef, SlotRef, TeamConflict, TeamBlackout } from "@/lib/scheduler/types"

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

    // 3. For each group, load teams and generate round-robin pairings → MatchRef[]
    const allMatches: MatchRef[] = []
    for (const group of groupRows) {
      const teamRows = await db
        .select()
        .from(teams)
        .where(eq(teams.groupId, group.id))

      if (teamRows.length < 2) continue

      const pairings = generateRoundRobinPairings(
        teamRows.map((t) => ({ id: t.id, name: t.name }))
      )

      for (const [teamA, teamB] of pairings) {
        allMatches.push({
          teamAId: teamA.id,
          teamBId: teamB.id,
          groupId: group.id,
          format: group.format,
        })
      }
    }

    if (allMatches.length === 0) {
      return NextResponse.json(
        { error: "No matches to schedule (groups need at least 2 teams)" },
        { status: 400 }
      )
    }

    // 4. Load all grounds, gameDays, timeSlots for this tournament
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

    // 5. Build SlotRef array (join timeSlots with grounds for groundFormat, with gameDays for date)
    const groundMap = new Map(groundRows.map((g) => [g.id, g]))
    const gameDayMap = new Map(gameDayRows.map((gd) => [gd.id, gd]))

    const slotRefs: SlotRef[] = []
    for (const ts of timeSlotRows) {
      const ground = groundMap.get(ts.groundId)
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

    // 6. Load all teamConflicts for teams in this tournament
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

    // 7. Load team blackout dates
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

    // 8. Load existing locked/played matches as existingSchedule
    const existingMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          inArray(matches.groupId, groupIds),
          or(eq(matches.isLocked, true), eq(matches.status, "played"))
        )
      )

    const existingSchedule = existingMatches
      .filter((m) => m.timeSlotId !== null)
      .map((m) => ({
        timeSlotId: m.timeSlotId!,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        umpireTeam1Id: m.umpireTeam1Id ?? undefined,
        umpireTeam2Id: m.umpireTeam2Id ?? undefined,
      }))

    // 8. Load all division team IDs (for umpire selection)
    // Collect all teams across all divisions in this tournament
    const divisionTeamIds = allTeamIds

    // 9. Build teamFormatMap: teamId → format (from group)
    const groupFormatMap = new Map(groupRows.map((g) => [g.id, g.format]))
    const teamFormatMap = new Map<number, string>()
    for (const t of allTeamRows) {
      const format = groupFormatMap.get(t.groupId)
      if (format) teamFormatMap.set(t.id, format)
    }

    // 10. Call generateGroupSchedule
    const result = generateGroupSchedule({
      matches: allMatches,
      slots: slotRefs,
      conflicts: conflictRows,
      blackouts: blackoutRows,
      existingSchedule,
      divisionTeamIds,
      teamFormatMap,
    })

    // 10. Insert scheduled matches into DB
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

    // 11. Return result
    return NextResponse.json({
      scheduled: insertedCount,
      unschedulable: result.unschedulable,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
