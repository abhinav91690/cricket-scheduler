"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { listConflicts, createConflict, updateConflictLevel, deleteConflict } from "@/app/actions/conflict-actions"
import { listBlackouts, createBlackout, deleteBlackout } from "@/app/actions/blackout-actions"
import { listAllTeamsForTournament, type TeamWithContext } from "@/app/actions/team-list-actions"
import { TournamentNav } from "@/components/nav"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Conflict = { id: number; teamAId: number; teamBId: number; level: string }
type Blackout = { id: number; teamId: number; date: string }

export default function ConflictsPage() {
  const params = useParams()
  const tournamentId = Number(params.id)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [blackouts, setBlackouts] = useState<Blackout[]>([])
  const [allTeams, setAllTeams] = useState<TeamWithContext[]>([])
  const [teamMap, setTeamMap] = useState<Map<number, TeamWithContext>>(new Map())
  const [showForm, setShowForm] = useState(false)
  const [teamAId, setTeamAId] = useState("")
  const [teamBId, setTeamBId] = useState("")
  const [level, setLevel] = useState<"same_slot" | "same_day">("same_slot")
  const [error, setError] = useState<string | null>(null)
  const [showBlackoutForm, setShowBlackoutForm] = useState(false)
  const [blackoutTeamId, setBlackoutTeamId] = useState("")
  const [blackoutDate, setBlackoutDate] = useState("")
  const [blackoutError, setBlackoutError] = useState<string | null>(null)

  function load() {
    listConflicts(tournamentId).then((r) => setConflicts(r.data ?? []))
    listBlackouts(tournamentId).then((r) => setBlackouts(r.data ?? []))
    listAllTeamsForTournament(tournamentId).then((r) => {
      const teams = r.data ?? []
      setAllTeams(teams)
      setTeamMap(new Map(teams.map(t => [t.id, t])))
    })
  }
  useEffect(load, [tournamentId])

  async function handleCreate() {
    setError(null)
    if (!teamAId || !teamBId) { setError("Select both teams"); return }
    if (teamAId === teamBId) { setError("Teams must be different"); return }
    const res = await createConflict({
      teamAId: Number(teamAId),
      teamBId: Number(teamBId),
      level,
    })
    if (res.error) { setError(res.error); return }
    setShowForm(false)
    setTeamAId("")
    setTeamBId("")
    load()
  }

  async function handleToggleLevel(c: Conflict) {
    const newLevel = c.level === "same_slot" ? "same_day" : "same_slot"
    const res = await updateConflictLevel(c.id, newLevel as "same_slot" | "same_day")
    if (res.error) setError(res.error)
    else load()
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this conflict?")) return
    const res = await deleteConflict(id)
    if (res.error) setError(res.error)
    else load()
  }

  function teamLabel(t: TeamWithContext) {
    return t.name + " (" + t.groupName + ", " + t.divisionName + ")"
  }

  async function handleCreateBlackout() {
    setBlackoutError(null)
    if (!blackoutTeamId) { setBlackoutError("Select a team"); return }
    if (!blackoutDate) { setBlackoutError("Select a date"); return }
    const res = await createBlackout({ teamId: Number(blackoutTeamId), date: blackoutDate })
    if (res.error) { setBlackoutError(res.error); return }
    setShowBlackoutForm(false)
    setBlackoutTeamId("")
    setBlackoutDate("")
    load()
  }

  async function handleDeleteBlackout(id: number) {
    if (!confirm("Delete this blackout date?")) return
    const res = await deleteBlackout(id)
    if (res.error) setBlackoutError(res.error)
    else load()
  }

  // Group teams by division+group for the optgroup display
  const groupedTeams = new Map<string, TeamWithContext[]>()
  for (const t of allTeams) {
    const key = `${t.divisionName} — ${t.groupName}`
    if (!groupedTeams.has(key)) groupedTeams.set(key, [])
    groupedTeams.get(key)!.push(t)
  }

  return (
    <div>
      <TournamentNav tournamentId={String(tournamentId)} />
      <div className="max-w-5xl mx-auto mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Team Conflicts</h2>
          <Button onClick={() => setShowForm(true)}>Add Conflict</Button>
        </div>
        {error && <p className="text-destructive text-sm mb-4">{error}</p>}

        {showForm && (
          <Card className="mb-4">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="teamA">Team A</Label>
                  <select
                    id="teamA"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={teamAId}
                    onChange={(e) => setTeamAId(e.target.value)}
                  >
                    <option value="">Select team...</option>
                    {[...groupedTeams.entries()].map(([group, teams]) => (
                      <optgroup key={group} label={group}>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="teamB">Team B</Label>
                  <select
                    id="teamB"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={teamBId}
                    onChange={(e) => setTeamBId(e.target.value)}
                  >
                    <option value="">Select team...</option>
                    {[...groupedTeams.entries()].map(([group, teams]) => (
                      <optgroup key={group} label={group}>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="level">Level</Label>
                  <select
                    id="level"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={level}
                    onChange={(e) => setLevel(e.target.value as "same_slot" | "same_day")}
                  >
                    <option value="same_slot">Same Slot</option>
                    <option value="same_day">Same Day</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate}>Create</Button>
                <Button variant="secondary" onClick={() => { setShowForm(false); setError(null) }}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team A</TableHead>
              <TableHead>Team B</TableHead>
              <TableHead>Level</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conflicts.map((c) => {
              const tA = teamMap.get(c.teamAId)
              const tB = teamMap.get(c.teamBId)
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div>{tA?.name ?? `Team ${c.teamAId}`}</div>
                    {tA && <div className="text-xs text-muted-foreground">{tA.groupName}, {tA.divisionName}</div>}
                  </TableCell>
                  <TableCell>
                    <div>{tB?.name ?? `Team ${c.teamBId}`}</div>
                    {tB && <div className="text-xs text-muted-foreground">{tB.groupName}, {tB.divisionName}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={c.level === "same_day" ? "destructive" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleToggleLevel(c)}
                    >
                      {c.level === "same_slot" ? "Same Slot" : "Same Day"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(c.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {conflicts.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground text-center">No conflicts defined</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        {/* Blackout Dates Section */}
        <div className="flex items-center justify-between mb-4 mt-10">
          <h2 className="text-xl font-bold">Blackout Dates</h2>
          <Button onClick={() => setShowBlackoutForm(true)}>Add Blackout</Button>
        </div>
        {blackoutError && <p className="text-destructive text-sm mb-4">{blackoutError}</p>}

        {showBlackoutForm && (
          <Card className="mb-4">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="blackoutTeam">Team</Label>
                  <select
                    id="blackoutTeam"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={blackoutTeamId}
                    onChange={(e) => setBlackoutTeamId(e.target.value)}
                  >
                    <option value="">Select team...</option>
                    {[...groupedTeams.entries()].map(([group, teams]) => (
                      <optgroup key={group} label={group}>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="blackoutDate">Date</Label>
                  <input
                    id="blackoutDate"
                    type="date"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={blackoutDate}
                    onChange={(e) => setBlackoutDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateBlackout}>Create</Button>
                <Button variant="secondary" onClick={() => { setShowBlackoutForm(false); setBlackoutError(null) }}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blackouts.map((b) => {
              const team = teamMap.get(b.teamId)
              return (
                <TableRow key={b.id}>
                  <TableCell>
                    <div>{team?.name ?? ("Team " + b.teamId)}</div>
                    {team && <div className="text-xs text-muted-foreground">{team.groupName}, {team.divisionName}</div>}
                  </TableCell>
                  <TableCell>{b.date}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteBlackout(b.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {blackouts.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-muted-foreground text-center">No blackout dates defined</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
