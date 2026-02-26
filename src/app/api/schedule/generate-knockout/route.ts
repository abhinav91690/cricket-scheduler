export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { db } from "@/lib/db/connection"
import {
  tournaments,
  divisions,
  groups,
  teams,
  teamConflicts,
  grounds,
  gameDays,
  timeSlots,
  matches,
} from "@/lib/db/schema"
import { eq, and, or, inArray, ne } from "drizzle-orm"
import { calculateStandings } from "@/lib/scheduler/standings"
import { generateKnockoutBracket } from "@/lib/scheduler/knockout"
import type { QualifiedTeam } from "@/lib/scheduler/knockout"
import type { TeamConflict, SlotRef, OccupancyMap } from "@/lib/scheduler/types"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tournamentId, format } = body as {
      tournamentId: number
      format: "leather" | "tape_ball"
    }

    if (!tournamentId || !format) {
      return NextResponse.json(
        { error: "tournamentId and format are required" },
        { status: 400 }
      )
    }

    if (format !== "leather" && format !== "tape_ball") {
      return NextResponse.json(
        { error: 'format must be "leather" or "tape_ball"' },
        { status: 400 }
      )
    }

    // 1. Load tournament to get qualifier counts
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found" },
        { status: 404 }
      )
    }

    const qualifierCount =
      format === "leather"
        ? tournament.leatherQualifierCount
        : tournament.tapeBallQualifierCount

    // 2. Load divisions for this tournament
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

    // 3. Load groups matching the requested format
    const groupRows = await db
      .select()
      .from(groups)
      .where(inArray(groups.divisionId, divisionIds))

    const formatGroups = groupRows.filter((g) => g.format === format)

    if (formatGroups.length === 0) {
      return NextResponse.json(
        { error: `No groups found with format "${format}"` },
        { status: 404 }
      )
    }

    const formatGroupIds = formatGroups.map((g) => g.id)

    // 4. For each group, load teams and played matches, calculate standings
    //    Also check that all group matches are played
    const pendingMatches: Array<{ matchId: number; teamAId: number; teamBId: number; groupId: number }> = []
    const allQualifiers: QualifiedTeam[] = []

    for (const group of formatGroups) {
      const teamRows = await db
        .select()
        .from(teams)
        .where(eq(teams.groupId, group.id))

      if (teamRows.length < 2) continue

      const teamIds = teamRows.map((t) => t.id)

      // Load all group-stage matches for this group
      const groupMatches = await db
        .select()
        .from(matches)
        .where(
          and(
            eq(matches.groupId, group.id),
            eq(matches.stage, "group")
          )
        )

      // Check for pending (non-played) matches
      const pending = groupMatches.filter((m) => m.status !== "played")
      for (const m of pending) {
        pendingMatches.push({
          matchId: m.id,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          groupId: group.id,
        })
      }

      // Calculate standings from played matches
      const playedMatches = groupMatches
        .filter((m) => m.status === "played")
        .map((m) => ({
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          teamAScore: m.teamAScore ?? 0,
          teamBScore: m.teamBScore ?? 0,
          winnerId: m.winnerId,
          status: "played" as const,
        }))

      const standings = calculateStandings(teamIds, playedMatches)

      // Get top N qualifiers from this group
      const topN = standings.slice(0, qualifierCount)
      for (let i = 0; i < topN.length; i++) {
        allQualifiers.push({
          teamId: topN[i].teamId,
          groupRank: i + 1,
          groupId: group.id,
        })
      }
    }

    // 5. Block if any group matches are still pending
    if (pendingMatches.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot generate knockout bracket: some group matches are not yet played",
          pendingMatches,
        },
        { status: 400 }
      )
    }

    if (allQualifiers.length < 2) {
      return NextResponse.json(
        { error: "Not enough qualifiers to generate a knockout bracket (need at least 2)" },
        { status: 400 }
      )
    }

    // 6. Load available slots (grounds matching format)
    const groundRows = await db
      .select()
      .from(grounds)
      .where(
        and(
          eq(grounds.tournamentId, tournamentId),
          eq(grounds.format, format)
        )
      )

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

    // 7. Load conflicts for teams in this tournament
    const allGroupIds = groupRows.map((g) => g.id)
    const allTeamRows = await db
      .select()
      .from(teams)
      .where(inArray(teams.groupId, allGroupIds))
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

    // 8. Build existing occupancy from all scheduled matches
    const existingMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          inArray(matches.groupId, allGroupIds),
          ne(matches.timeSlotId, 0) // has a slot assigned
        )
      )

    const occupancy: OccupancyMap = new Map()
    const umpireCounts = new Map<number, number>()

    for (const m of existingMatches) {
      if (m.timeSlotId === null) continue
      if (!occupancy.has(m.timeSlotId)) {
        occupancy.set(m.timeSlotId, [])
      }
      const slotTeams = occupancy.get(m.timeSlotId)!
      slotTeams.push(m.teamAId, m.teamBId)
      if (m.umpireTeam1Id) {
        slotTeams.push(m.umpireTeam1Id)
        umpireCounts.set(m.umpireTeam1Id, (umpireCounts.get(m.umpireTeam1Id) ?? 0) + 1)
      }
      if (m.umpireTeam2Id) {
        slotTeams.push(m.umpireTeam2Id)
        umpireCounts.set(m.umpireTeam2Id, (umpireCounts.get(m.umpireTeam2Id) ?? 0) + 1)
      }
    }

    // 9. Division team IDs for umpire selection
    const divisionTeamIds = allTeamIds

    // 10. Call generateKnockoutBracket
    const result = generateKnockoutBracket(
      allQualifiers,
      slotRefs,
      conflictRows,
      divisionTeamIds,
      occupancy,
      umpireCounts
    )

    // 11. Insert knockout matches into DB
    let insertedCount = 0
    for (const sm of result.scheduled) {
      await db.insert(matches).values({
        groupId: null,
        teamAId: sm.teamAId,
        teamBId: sm.teamBId,
        timeSlotId: sm.timeSlotId,
        stage: "knockout",
        knockoutRound: sm.knockoutRound,
        umpireTeam1Id: sm.umpireTeam1Id,
        umpireTeam2Id: sm.umpireTeam2Id,
      })
      insertedCount++
    }

    // 12. Return bracket and scheduled count
    return NextResponse.json({
      bracket: result.bracket,
      scheduled: insertedCount,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
