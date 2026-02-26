export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { db } from "@/lib/db/connection"
import {
  divisions,
  groups,
  teams,
  grounds,
  gameDays,
  timeSlots,
  matches,
} from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import {
  exportToCSV,
  exportToExcel,
  filterMatches,
} from "@/lib/export/export"
import type { MatchView, ScheduleFilters } from "@/lib/export/export"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const format = url.searchParams.get("format")
    const tournamentIdParam = url.searchParams.get("tournamentId")
    const formatFilter = url.searchParams.get("formatFilter") ?? undefined
    const divisionFilter = url.searchParams.get("division") ?? undefined
    const groupFilter = url.searchParams.get("group") ?? undefined
    const teamFilter = url.searchParams.get("team") ?? undefined

    // Validate required params
    if (!format || (format !== "csv" && format !== "excel")) {
      return NextResponse.json(
        { error: 'format query param is required and must be "csv" or "excel"' },
        { status: 400 }
      )
    }

    if (!tournamentIdParam) {
      return NextResponse.json(
        { error: "tournamentId query param is required" },
        { status: 400 }
      )
    }

    const tournamentId = Number(tournamentIdParam)
    if (Number.isNaN(tournamentId)) {
      return NextResponse.json(
        { error: "tournamentId must be a number" },
        { status: 400 }
      )
    }

    // Load divisions → groups for this tournament
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
    const divisionMap = new Map(divisionRows.map((d) => [d.id, d]))

    const groupRows = await db
      .select()
      .from(groups)
      .where(inArray(groups.divisionId, divisionIds))

    const groupIds = groupRows.map((g) => g.id)
    const groupMap = new Map(groupRows.map((g) => [g.id, g]))

    // Load all matches for these groups (plus knockout matches via team membership)
    let matchRows: Array<typeof matches.$inferSelect> = []
    if (groupIds.length > 0) {
      matchRows = await db
        .select()
        .from(matches)
        .where(inArray(matches.groupId, groupIds))
    }

    if (matchRows.length === 0) {
      // Return empty export
      if (format === "csv") {
        return new Response(exportToCSV([]), {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="schedule.csv"',
          },
        })
      }
      const buffer = exportToExcel([])
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="schedule.xlsx"',
        },
      })
    }

    // Load teams for name lookup
    const allTeamRows = await db
      .select()
      .from(teams)
      .where(inArray(teams.groupId, groupIds))
    const teamMap = new Map(allTeamRows.map((t) => [t.id, t]))

    // Load grounds, gameDays, timeSlots for name/date/time lookup
    const groundRows = await db
      .select()
      .from(grounds)
      .where(eq(grounds.tournamentId, tournamentId))
    const groundMap = new Map(groundRows.map((g) => [g.id, g]))

    const gameDayRows = await db
      .select()
      .from(gameDays)
      .where(eq(gameDays.tournamentId, tournamentId))
    const gameDayMap = new Map(gameDayRows.map((gd) => [gd.id, gd]))

    const gameDayIds = gameDayRows.map((gd) => gd.id)
    let timeSlotRows: Array<typeof timeSlots.$inferSelect> = []
    if (gameDayIds.length > 0) {
      timeSlotRows = await db
        .select()
        .from(timeSlots)
        .where(inArray(timeSlots.gameDayId, gameDayIds))
    }
    const timeSlotMap = new Map(timeSlotRows.map((ts) => [ts.id, ts]))

    // Build MatchView[] from DB rows
    const matchViews: MatchView[] = matchRows.map((m) => {
      const group = m.groupId ? groupMap.get(m.groupId) : undefined
      const division = group
        ? divisionMap.get(group.divisionId)
        : undefined
      const slot = m.timeSlotId ? timeSlotMap.get(m.timeSlotId) : undefined
      const ground = slot ? groundMap.get(slot.groundId) : undefined
      const gameDay = slot ? gameDayMap.get(slot.gameDayId) : undefined

      const teamA = teamMap.get(m.teamAId)
      const teamB = teamMap.get(m.teamBId)
      const umpire1 = m.umpireTeam1Id
        ? teamMap.get(m.umpireTeam1Id)
        : undefined
      const umpire2 = m.umpireTeam2Id
        ? teamMap.get(m.umpireTeam2Id)
        : undefined

      const score =
        m.status === "played" && m.teamAScore !== null && m.teamBScore !== null
          ? `${m.teamAScore}-${m.teamBScore}`
          : ""

      return {
        date: gameDay?.date ?? "",
        time: slot?.startTime ?? "",
        ground: ground?.name ?? "",
        teamA: teamA?.name ?? "",
        teamB: teamB?.name ?? "",
        umpire1: umpire1?.name ?? "",
        umpire2: umpire2?.name ?? "",
        status: m.status,
        score,
        format: group?.format,
        division: division?.name,
        group: group?.name,
        teamIds: [m.teamAId, m.teamBId],
      }
    })

    // Apply filters
    const filters: ScheduleFilters = {
      format: formatFilter,
      division: divisionFilter,
      group: groupFilter,
      team: teamFilter,
    }
    const filtered = filterMatches(matchViews, filters)

    // Return appropriate format
    if (format === "csv") {
      const csv = exportToCSV(filtered)
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="schedule.csv"',
        },
      })
    }

    // Excel
    const buffer = exportToExcel(filtered)
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="schedule.xlsx"',
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
