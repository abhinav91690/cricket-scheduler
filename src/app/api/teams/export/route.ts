import { NextResponse } from "next/server"
import { db } from "@/lib/db/connection"
import { divisions, groups, teams } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import * as XLSX from "xlsx"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const tournamentId = Number(url.searchParams.get("tournamentId"))

    if (!tournamentId || Number.isNaN(tournamentId)) {
      return NextResponse.json({ error: "tournamentId is required" }, { status: 400 })
    }

    const divisionRows = await db.select().from(divisions).where(eq(divisions.tournamentId, tournamentId))
    const divisionIds = divisionRows.map((d) => d.id)

    let groupRows: Array<{ id: number; divisionId: number; format: string; name: string }> = []
    if (divisionIds.length > 0) {
      groupRows = await db.select().from(groups).where(inArray(groups.divisionId, divisionIds))
    }

    const groupIds = groupRows.map((g) => g.id)
    let teamRows: Array<{ id: number; groupId: number; name: string }> = []
    if (groupIds.length > 0) {
      teamRows = await db.select().from(teams).where(inArray(teams.groupId, groupIds))
    }

    const divMap = new Map(divisionRows.map((d) => [d.id, d]))
    const groupMap = new Map(groupRows.map((g) => [g.id, g]))

    // Build rows: Division, Tier, Group, Format, Team
    const header = ["Division", "Tier", "Group", "Format", "Team"]
    const rows = teamRows.map((t) => {
      const group = groupMap.get(t.groupId)!
      const div = divMap.get(group.divisionId)!
      return [div.name, div.tier, group.name, group.format, t.name]
    })

    // Sort by division tier, then group name, then team name
    rows.sort((a, b) => {
      if (a[1] !== b[1]) return (a[1] as number) - (b[1] as number)
      if (a[2] !== b[2]) return String(a[2]).localeCompare(String(b[2]))
      return String(a[4]).localeCompare(String(b[4]))
    })

    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([header, ...rows])
    XLSX.utils.book_append_sheet(workbook, sheet, "Teams")

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="teams.xlsx"',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
