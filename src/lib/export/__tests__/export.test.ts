import { describe, it, expect } from "vitest"
import {
  filterMatches,
  exportToCSV,
  exportToExcel,
  type MatchView,
  type ScheduleFilters,
} from "../export"
import * as XLSX from "xlsx"

function makeMatch(overrides: Partial<MatchView> = {}): MatchView {
  return {
    date: "2025-03-01",
    time: "10:00",
    ground: "Ground A",
    teamA: "Team Alpha",
    teamB: "Team Beta",
    umpire1: "Team Gamma",
    umpire2: "",
    status: "scheduled",
    score: "",
    format: "leather",
    division: "Division 1",
    group: "Group A",
    ...overrides,
  }
}

const sampleMatches: MatchView[] = [
  makeMatch({
    teamA: "Team Alpha",
    teamB: "Team Beta",
    format: "leather",
    division: "Division 1",
    group: "Group A",
  }),
  makeMatch({
    date: "2025-03-02",
    teamA: "Team Gamma",
    teamB: "Team Delta",
    format: "tape_ball",
    division: "Division 2",
    group: "Group B",
    ground: "Ground B",
    umpire1: "Team Alpha",
  }),
  makeMatch({
    date: "2025-03-03",
    teamA: "Team Alpha",
    teamB: "Team Gamma",
    format: "leather",
    division: "Division 1",
    group: "Group A",
    ground: "Ground C",
    umpire1: "Team Beta",
  }),
]

describe("filterMatches", () => {
  it("returns all matches when no filters provided", () => {
    expect(filterMatches(sampleMatches)).toEqual(sampleMatches)
    expect(filterMatches(sampleMatches, {})).toEqual(sampleMatches)
    expect(filterMatches(sampleMatches, undefined)).toEqual(sampleMatches)
  })

  it("filters by format", () => {
    const result = filterMatches(sampleMatches, { format: "leather" })
    expect(result).toHaveLength(2)
    expect(result.every((m: MatchView) => m.format === "leather")).toBe(true)
  })

  it("filters by division", () => {
    const result = filterMatches(sampleMatches, { division: "Division 2" })
    expect(result).toHaveLength(1)
    expect(result[0].teamA).toBe("Team Gamma")
  })

  it("filters by group", () => {
    const result = filterMatches(sampleMatches, { group: "Group B" })
    expect(result).toHaveLength(1)
    expect(result[0].teamB).toBe("Team Delta")
  })

  it("filters by team (matches teamA or teamB)", () => {
    const result = filterMatches(sampleMatches, { team: "Team Alpha" })
    expect(result).toHaveLength(2)
    expect(result.every((m: MatchView) => m.teamA === "Team Alpha" || m.teamB === "Team Alpha")).toBe(true)
  })

  it("applies multiple filters (AND logic)", () => {
    const result = filterMatches(sampleMatches, {
      format: "leather",
      team: "Team Alpha",
    })
    expect(result).toHaveLength(2)
  })

  it("returns empty array when no matches pass filters", () => {
    const result = filterMatches(sampleMatches, { format: "tape_ball", team: "Team Alpha" })
    expect(result).toHaveLength(0)
  })
})


describe("exportToCSV", () => {
  it("produces correct CSV headers", () => {
    const csv = exportToCSV([])
    const headerLine = csv.split("\n")[0]
    expect(headerLine).toBe("Date,Time,Ground,Team A,Team B,Umpire 1,Umpire 2,Status,Score")
  })

  it("produces one data row per match", () => {
    const csv = exportToCSV(sampleMatches)
    const lines = csv.split("\n").filter((l: string) => l.trim() !== "")
    // 1 header + 3 data rows
    expect(lines).toHaveLength(4)
  })

  it("includes correct field values in rows", () => {
    const match = makeMatch({
      date: "2025-04-01",
      time: "14:00",
      ground: "Oval",
      teamA: "Lions",
      teamB: "Tigers",
      umpire1: "Bears",
      umpire2: "Wolves",
      status: "played",
      score: "150-120",
    })
    const csv = exportToCSV([match])
    const dataRow = csv.split("\n")[1]
    expect(dataRow).toBe("2025-04-01,14:00,Oval,Lions,Tigers,Bears,Wolves,played,150-120")
  })

  it("applies filters before exporting", () => {
    const csv = exportToCSV(sampleMatches, { format: "tape_ball" })
    const lines = csv.split("\n").filter((l: string) => l.trim() !== "")
    expect(lines).toHaveLength(2) // header + 1 match
  })

  it("escapes fields containing commas", () => {
    const match = makeMatch({ ground: "Ground A, North" })
    const csv = exportToCSV([match])
    const dataRow = csv.split("\n")[1]
    expect(dataRow).toContain('"Ground A, North"')
  })

  it("escapes fields containing double quotes", () => {
    const match = makeMatch({ teamA: 'The "Best" Team' })
    const csv = exportToCSV([match])
    const dataRow = csv.split("\n")[1]
    expect(dataRow).toContain('"The ""Best"" Team"')
  })
})

describe("exportToExcel", () => {
  it("returns a Buffer", () => {
    const buf = exportToExcel(sampleMatches)
    expect(Buffer.isBuffer(buf)).toBe(true)
  })

  it("produces a valid workbook with a Schedule sheet", () => {
    const buf = exportToExcel(sampleMatches)
    const workbook = XLSX.read(buf, { type: "buffer" })
    expect(workbook.SheetNames).toContain("Schedule")
  })

  it("contains correct headers in the first row", () => {
    const buf = exportToExcel(sampleMatches)
    const workbook = XLSX.read(buf, { type: "buffer" })
    const sheet = workbook.Sheets["Schedule"]
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    expect(data[0]).toEqual([
      "Date", "Time", "Ground", "Team A", "Team B",
      "Umpire 1", "Umpire 2", "Status", "Score",
    ])
  })

  it("contains correct number of data rows", () => {
    const buf = exportToExcel(sampleMatches)
    const workbook = XLSX.read(buf, { type: "buffer" })
    const sheet = workbook.Sheets["Schedule"]
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    // 1 header + 3 data rows
    expect(data).toHaveLength(4)
  })

  it("applies filters before exporting", () => {
    const buf = exportToExcel(sampleMatches, { format: "leather" })
    const workbook = XLSX.read(buf, { type: "buffer" })
    const sheet = workbook.Sheets["Schedule"]
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    // 1 header + 2 leather matches
    expect(data).toHaveLength(3)
  })

  it("contains correct field values in data rows", () => {
    const match = makeMatch({
      date: "2025-04-01",
      time: "14:00",
      ground: "Oval",
      teamA: "Lions",
      teamB: "Tigers",
      umpire1: "Bears",
      umpire2: "Wolves",
      status: "played",
      score: "150-120",
    })
    const buf = exportToExcel([match])
    const workbook = XLSX.read(buf, { type: "buffer" })
    const sheet = workbook.Sheets["Schedule"]
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    expect(data[1]).toEqual([
      "2025-04-01", "14:00", "Oval", "Lions", "Tigers",
      "Bears", "Wolves", "played", "150-120",
    ])
  })
})
