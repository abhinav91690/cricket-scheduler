"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { listMatches } from "@/app/actions/match-actions"
import { listDivisions, listGroups } from "@/app/actions/division-actions"
import { listTeams } from "@/app/actions/team-actions"
import { TournamentNav } from "@/components/nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type Match = {
  id: number; groupId: number | null; teamAId: number; teamBId: number
  timeSlotId: number | null; stage: string; status: string
  teamAScore: number | null; teamBScore: number | null; winnerId: number | null
  umpireTeam1Id: number | null; umpireTeam2Id: number | null
  isLocked: boolean; knockoutRound: number | null
}
type Team = { id: number; name: string }

export default function KnockoutPage() {
  const params = useParams()
  const tournamentId = Number(params.id)
  const [knockoutMatches, setKnockoutMatches] = useState<Match[]>([])
  const [teamMap, setTeamMap] = useState<Map<number, Team>>(new Map())
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    const matchRes = await listMatches({ tournamentId, stage: "knockout" })
    setKnockoutMatches(matchRes.data ?? [])

    // Load teams
    const divRes = await listDivisions(tournamentId)
    const allTeams: Team[] = []
    for (const div of divRes.data ?? []) {
      const gRes = await listGroups(div.id)
      for (const g of gRes.data ?? []) {
        const tRes = await listTeams(g.id)
        allTeams.push(...(tRes.data ?? []))
      }
    }
    setTeamMap(new Map(allTeams.map(t => [t.id, t])))
  }

  useEffect(() => { load() }, [tournamentId])

  async function handleGenerate() {
    setGenerating(true)
    setMessage(null)
    try {
      const res = await fetch("/api/schedule/generate-knockout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId }),
      })
      const data = await res.json()
      if (data.error) setMessage(`Error: ${data.error}`)
      else setMessage(`Knockout bracket generated with ${data.matchCount ?? 0} matches.`)
      load()
    } catch { setMessage("Failed to generate knockout bracket") }
    setGenerating(false)
  }

  // Group matches by round
  const byRound = new Map<number, Match[]>()
  for (const m of knockoutMatches) {
    const round = m.knockoutRound ?? 1
    if (!byRound.has(round)) byRound.set(round, [])
    byRound.get(round)!.push(m)
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b)

  return (
    <div>
      <TournamentNav tournamentId={String(tournamentId)} />
      <div className="max-w-6xl mx-auto mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Knockout Bracket</h2>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating..." : "Generate Knockout"}
          </Button>
        </div>

        {message && <p className="text-sm mb-4 p-2 bg-muted rounded">{message}</p>}

        {rounds.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No knockout matches yet. Complete group stage matches first, then generate the bracket.
          </p>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-4">
            {rounds.map((round) => (
              <div key={round} className="min-w-[250px]">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Round {round}
                </h3>
                <div className="space-y-3">
                  {byRound.get(round)!.map((m) => {
                    const teamA = teamMap.get(m.teamAId)
                    const teamB = teamMap.get(m.teamBId)
                    return (
                      <Card key={m.id} className={m.status === "played" ? "border-green-300" : ""}>
                        <CardContent className="p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm ${m.winnerId === m.teamAId ? "font-bold" : ""}`}>
                              {teamA?.name ?? `Team ${m.teamAId}`}
                            </span>
                            {m.status === "played" && (
                              <span className="text-sm font-mono">{m.teamAScore}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm ${m.winnerId === m.teamBId ? "font-bold" : ""}`}>
                              {teamB?.name ?? `Team ${m.teamBId}`}
                            </span>
                            {m.status === "played" && (
                              <span className="text-sm font-mono">{m.teamBScore}</span>
                            )}
                          </div>
                          <Badge variant={m.status === "played" ? "default" : "outline"} className="text-xs">
                            {m.status}
                          </Badge>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
