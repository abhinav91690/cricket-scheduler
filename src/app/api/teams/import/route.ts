import { NextResponse } from "next/server"
import { db } from "@/lib/db/connection"
import { divisions, groups, teams } from "@/lib/db/schema"
import * as XLSX from "xlsx"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const tournamentId = Number(formData.get("tournamentId"))

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }
    if (!tournamentId || Number.isNaN(tournamentId)) {
      return NextResponse.json({ error: "tournamentId is required" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) {
      return NextResponse.json({ error: "Excel file has no sheets" }, { status: 400 })
    }

    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
    if (rows.length < 2) {
      return NextResponse.json({ error: "File must have a header row and at least one data row" }, { status: 400 })
    }

    // Validate header
    const header = rows[0].map((h) => String(h).trim().toLowerCase())
    const expected = ["division", "tier", "group", "format", "team"]
    for (let i = 0; i < expected.length; i++) {
      if (header[i] !== expected[i]) {
        const msg = "Column " + (i + 1) + ' should be "' + expected[i] + '" but got "' + (header[i] ?? "(missing)") + '"'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    // Parse and validate data rows
    const errors: string[] = []
    const dataRows: Array<{ division: string; tier: number; group: string; format: string; team: string }> = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || row.length === 0 || row.every((c) => !c || String(c).trim() === "")) continue

      const division = String(row[0] ?? "").trim()
      const tier = Number(row[1])
      const group = String(row[2] ?? "").trim()
      const format = String(row[3] ?? "").trim().toLowerCase()
      const team = String(row[4] ?? "").trim()

      const rowLabel = "Row " + (i + 1)
      if (!division) errors.push(rowLabel + ": Division is required")
      if (!Number.isInteger(tier) || tier < 1 || tier > 4) errors.push(rowLabel + ": Tier must be 1-4")
      if (!group) errors.push(rowLabel + ": Group is required")
      if (format !== "leather" && format !== "tape_ball") errors.push(rowLabel + ': Format must be "leather" or "tape_ball"')
      if (!team) errors.push(rowLabel + ": Team is required")

      if (errors.length === 0) {
        dataRows.push({ division, tier, group, format, team })
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("\n") }, { status: 400 })
    }

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "No data rows found" }, { status: 400 })
    }

    // Group by division, then by group to bulk-create
    const divCache = new Map<string, number>() // "divName" → divId
    const groupCache = new Map<string, number>() // "divName|groupName|format" → groupId
    let divCount = 0, groupCount = 0, teamCount = 0

    for (const row of dataRows) {
      // Create or reuse division
      if (!divCache.has(row.division)) {
        const [divRow] = await db.insert(divisions).values({
          tournamentId,
          tier: row.tier,
          name: row.division,
        }).returning()
        divCache.set(row.division, divRow.id)
        divCount++
      }
      const divId = divCache.get(row.division)!

      // Create or reuse group
      const groupKey = row.division + "|" + row.group + "|" + row.format
      if (!groupCache.has(groupKey)) {
        const [grpRow] = await db.insert(groups).values({
          divisionId: divId,
          format: row.format as "leather" | "tape_ball",
          name: row.group,
        }).returning()
        groupCache.set(groupKey, grpRow.id)
        groupCount++
      }
      const groupId = groupCache.get(groupKey)!

      // Create team
      await db.insert(teams).values({ groupId, name: row.team })
      teamCount++
    }

    return NextResponse.json({
      divisions: divCount,
      groups: groupCount,
      teams: teamCount,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
