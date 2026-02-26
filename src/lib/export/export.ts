import * as XLSX from "xlsx"

export interface MatchView {
  date: string
  time: string
  ground: string
  teamA: string
  teamB: string
  umpire1: string
  umpire2: string
  status: string
  score: string
  format?: string
  division?: string
  group?: string
  teamIds?: number[]
}

export interface ScheduleFilters {
  format?: string
  division?: string
  group?: string
  team?: string
}

export function filterMatches(
  matches: MatchView[],
  filters?: ScheduleFilters
): MatchView[] {
  if (!filters) return matches

  return matches.filter((m) => {
    if (filters.format && m.format !== filters.format) return false
    if (filters.division && m.division !== filters.division) return false
    if (filters.group && m.group !== filters.group) return false
    if (filters.team && m.teamA !== filters.team && m.teamB !== filters.team)
      return false
    return true
  })
}

const CSV_HEADERS = [
  "Date",
  "Time",
  "Ground",
  "Team A",
  "Team B",
  "Umpire 1",
  "Umpire 2",
  "Status",
  "Score",
] as const

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function matchToRow(m: MatchView): string[] {
  return [
    m.date,
    m.time,
    m.ground,
    m.teamA,
    m.teamB,
    m.umpire1,
    m.umpire2,
    m.status,
    m.score,
  ]
}

export function exportToCSV(
  matches: MatchView[],
  filters?: ScheduleFilters
): string {
  const filtered = filterMatches(matches, filters)
  const headerLine = CSV_HEADERS.join(",")
  const dataLines = filtered.map((m) =>
    matchToRow(m).map(escapeCSVField).join(",")
  )
  return [headerLine, ...dataLines].join("\n")
}

export function exportToExcel(
  matches: MatchView[],
  filters?: ScheduleFilters
): Buffer {
  const filtered = filterMatches(matches, filters)
  const rows = [
    [...CSV_HEADERS],
    ...filtered.map((m) => matchToRow(m)),
  ]

  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, "Schedule")

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}
