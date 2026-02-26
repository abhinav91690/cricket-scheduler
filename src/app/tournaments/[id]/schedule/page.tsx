"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { listMatches } from "@/app/actions/match-actions"
import { clearSchedule } from "@/app/actions/match-actions"
import { listDivisions, listGroups } from "@/app/actions/division-actions"
import { listGrounds, listGameDays, listTimeSlots } from "@/app/actions/ground-actions"
import { listTeams } from "@/app/actions/team-actions"
import { TournamentNav } from "@/components/nav"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { MatchDetailDialog } from "@/components/match-detail-dialog"

type Match = {
  id: number; groupId: number | null; teamAId: number; teamBId: number
  timeSlotId: number | null; stage: string; status: string
  teamAScore: number | null; teamBScore: number | null; winnerId: number | null
  umpireTeam1Id: number | null; umpireTeam2Id: number | null
  isLocked: boolean; conflictOverride: string | null; knockoutRound: number | null
}
type Division = { id: number; name: string; tier: number }
type Group = { id: number; divisionId: number; format: string; name: string }
type Ground = { id: number; name: string; format: string }
type GameDay = { id: number; date: string }
type TimeSlot = { id: number; gameDayId: number; groundId: number; startTime: string; slotIndex: number }
type Team = { id: number; groupId: number; name: string }

export default function SchedulePage() {
  const params = useParams()
  const tournamentId = Number(params.id)
  const [matchList, setMatchList] = useState<Match[]>([])
  const [divisionList, setDivisionList] = useState<Division[]>([])
  const [divisionMap, setDivisionMap] = useState<Map<number, Division>>(new Map())
  const [groupMap, setGroupMap] = useState<Map<number, Group>>(new Map())
  const [groundMap, setGroundMap] = useState<Map<number, Ground>>(new Map())
  const [gameDayMap, setGameDayMap] = useState<Map<number, GameDay>>(new Map())
  const [slotMap, setSlotMap] = useState<Map<number, TimeSlot>>(new Map())
  const [teamMap, setTeamMap] = useState<Map<number, Team>>(new Map())
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)

  // Filters
  const [filterFormat, setFilterFormat] = useState<string>("")
  const [filterDivision, setFilterDivision] = useState<string>("")
  const [filterGroup, setFilterGroup] = useState<string>("")

  const [generating, setGenerating] = useState(false)
  const [rescheduling, setRescheduling] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    const [matchRes, divRes, groundRes, gdRes] = await Promise.all([
      listMatches({ tournamentId }),
      listDivisions(tournamentId),
      listGrounds(tournamentId),
      listGameDays(tournamentId),
    ])
    setMatchList(matchRes.data ?? [])
    setDivisionList(divRes.data ?? [])
    setDivisionMap(new Map((divRes.data ?? []).map(d => [d.id, d])))
    setGroundMap(new Map((groundRes.data ?? []).map(g => [g.id, g])))
    const gds = gdRes.data ?? []
    setGameDayMap(new Map(gds.map(gd => [gd.id, gd])))

    // Load all groups and teams across divisions
    const allGroups: Group[] = []
    const allTeams: Team[] = []
    for (const div of divRes.data ?? []) {
      const gRes = await listGroups(div.id)
      const gs = gRes.data ?? []
      allGroups.push(...gs)
      for (const g of gs) {
        const tRes = await listTeams(g.id)
        allTeams.push(...(tRes.data ?? []))
      }
    }
    setGroupMap(new Map(allGroups.map(g => [g.id, g])))
    setTeamMap(new Map(allTeams.map(t => [t.id, t])))

    // Load all time slots
    const allSlots: TimeSlot[] = []
    for (const gd of gds) {
      const sRes = await listTimeSlots(gd.id)
      allSlots.push(...(sRes.data ?? []))
    }
    setSlotMap(new Map(allSlots.map(s => [s.id, s])))
  }

  useEffect(() => { load() }, [tournamentId])

  async function handleGenerate() {
    setGenerating(true)
    setMessage(null)
    try {
      const res = await fetch("/api/schedule/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId }),
      })
      const data = await res.json()
      if (data.error) setMessage(`Error: ${data.error}`)
      else setMessage(`Scheduled ${data.scheduledCount} matches. ${data.unschedulableCount ?? 0} unschedulable.`)
      load()
    } catch { setMessage("Failed to generate schedule") }
    setGenerating(false)
  }

  async function handleReschedule() {
    setRescheduling(true)
    setMessage(null)
    try {
      const res = await fetch("/api/schedule/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId }),
      })
      const data = await res.json()
      if (data.error) setMessage(`Error: ${data.error}`)
      else setMessage(`Rescheduled ${data.scheduledCount ?? 0} matches.`)
      load()
    } catch { setMessage("Failed to reschedule") }
    setRescheduling(false)
  }

  async function handleClear() {
    if (!confirm("Are you sure you want to delete ALL matches? This cannot be undone.")) return
    setClearing(true)
    setMessage(null)
    try {
      const result = await clearSchedule(tournamentId)
      setMessage(`Cleared ${result.deleted} matches.`)
      load()
    } catch { setMessage("Failed to clear schedule") }
    setClearing(false)
  }

  function handleExport(format: "csv" | "excel") {
    const params = new URLSearchParams({ format, tournamentId: String(tournamentId) })
    if (filterFormat) params.set("formatFilter", filterFormat)
    if (filterDivision) params.set("division", filterDivision)
    if (filterGroup) params.set("group", filterGroup)
    window.open(`/api/export?${params.toString()}`, "_blank")
  }

  // Filter matches
  const filtered = matchList.filter((m) => {
    if (!m.groupId) return true
    const group = groupMap.get(m.groupId)
    if (!group) return true
    if (filterFormat && group.format !== filterFormat) return false
    if (filterDivision && String(group.divisionId) !== filterDivision) return false
    if (filterGroup && String(m.groupId) !== filterGroup) return false
    return true
  })

  // Group matches by game day
  const byDay = new Map<string, Match[]>()
  for (const m of filtered) {
    const slot = m.timeSlotId ? slotMap.get(m.timeSlotId) : null
    const gd = slot ? gameDayMap.get(slot.gameDayId) : null
    const date = gd?.date ?? "Unscheduled"
    if (!byDay.has(date)) byDay.set(date, [])
    byDay.get(date)!.push(m)
  }
  const sortedDays = [...byDay.keys()].sort()

  return (
    <div>
      <TournamentNav tournamentId={String(tournamentId)} />
      <div className="max-w-6xl mx-auto mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Schedule</h2>
          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? "Generating..." : "Generate Schedule"}
            </Button>
            <Button variant="secondary" onClick={handleReschedule} disabled={rescheduling}>
              {rescheduling ? "Rescheduling..." : "Reschedule"}
            </Button>
            <Button variant="secondary" onClick={() => handleExport("csv")}>Export CSV</Button>
            <Button variant="secondary" onClick={() => handleExport("excel")}>Export Excel</Button>
            <Button variant="destructive" onClick={handleClear} disabled={clearing}>
              {clearing ? "Clearing..." : "Clear Schedule"}
            </Button>
          </div>
        </div>

        {message && <p className="text-sm mb-4 p-2 bg-muted rounded">{message}</p>}

        <div className="flex gap-4 mb-4">
          <div className="space-y-1">
            <Label>Format</Label>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterFormat} onChange={(e) => setFilterFormat(e.target.value)}>
              <option value="">All</option>
              <option value="leather">Leather</option>
              <option value="tape_ball">Tape Ball</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Division</Label>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterDivision} onChange={(e) => setFilterDivision(e.target.value)}>
              <option value="">All</option>
              {divisionList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Group</Label>
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
              <option value="">All</option>
              {[...groupMap.values()].map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-6">
          {sortedDays.map((date) => (
            <Card key={date}>
              <CardHeader>
                <CardTitle className="text-lg">{date}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {byDay.get(date)!.map((m) => {
                    const slot = m.timeSlotId ? slotMap.get(m.timeSlotId) : null
                    const ground = slot ? groundMap.get(slot.groundId) : null
                    const teamA = teamMap.get(m.teamAId)
                    const teamB = teamMap.get(m.teamBId)
                    const umpire1 = m.umpireTeam1Id ? teamMap.get(m.umpireTeam1Id) : null
                    const group = m.groupId ? groupMap.get(m.groupId) : null
                    const division = group ? divisionMap.get(group.divisionId) : null
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 p-2 rounded border hover:bg-accent/50 cursor-pointer"
                        onClick={() => setSelectedMatch(m)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter") setSelectedMatch(m) }}
                      >
                        <span className="text-sm text-muted-foreground w-16">{slot?.startTime ?? "—"}</span>
                        <span className="text-sm w-32 truncate">{ground?.name ?? "—"}</span>
                        <div className="flex gap-1.5 shrink-0">
                          {group && (
                            <Badge variant="outline" className="text-xs whitespace-nowrap px-2 py-0.5">
                              {group.format === "leather" ? "🔴" : "🎾"}
                            </Badge>
                          )}
                          {division && (
                            <Badge variant="secondary" className="text-xs whitespace-nowrap px-2 py-0.5">
                              {division.name}
                            </Badge>
                          )}
                          {group && (
                            <Badge variant="secondary" className="text-xs whitespace-nowrap px-2 py-0.5">
                              {group.name}
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-medium flex-1">
                          {teamA?.name ?? `Team ${m.teamAId}`} vs {teamB?.name ?? `Team ${m.teamBId}`}
                        </span>
                        {umpire1 && <span className="text-xs text-muted-foreground">Ump: {umpire1.name}</span>}
                        <Badge variant={m.status === "played" ? "default" : m.isLocked ? "secondary" : "outline"}>
                          {m.isLocked ? "Locked" : m.status}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
          {sortedDays.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No matches to display. Generate a schedule first.</p>
          )}
        </div>
      </div>

      {selectedMatch && (
        <MatchDetailDialog
          match={selectedMatch}
          teamMap={teamMap}
          slotMap={slotMap}
          groundMap={groundMap}
          gameDayMap={gameDayMap}
          onClose={() => setSelectedMatch(null)}
          onUpdate={load}
        />
      )}
    </div>
  )
}
