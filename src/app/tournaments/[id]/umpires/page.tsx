"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { listMatches } from "@/app/actions/match-actions"
import { listDivisions, listGroups } from "@/app/actions/division-actions"
import { listTeams } from "@/app/actions/team-actions"
import { TournamentNav } from "@/components/nav"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Match = {
  id: number; teamAId: number; teamBId: number; status: string
  umpireTeam1Id: number | null; umpireTeam2Id: number | null
}
type Team = { id: number; groupId: number; name: string }
type Division = { id: number; name: string }
type Group = { id: number; divisionId: number; name: string }

export default function UmpiresPage() {
  const params = useParams()
  const tournamentId = Number(params.id)
  const [divisionData, setDivisionData] = useState<{
    division: Division
    teams: Team[]
    umpireCounts: Map<number, number>
  }[]>([])

  useEffect(() => {
    async function load() {
      const matchRes = await listMatches({ tournamentId })
      const allMatches = matchRes.data ?? []
      const divRes = await listDivisions(tournamentId)

      const data = []
      for (const div of divRes.data ?? []) {
        const gRes = await listGroups(div.id)
        const divTeams: Team[] = []
        const groupIds = new Set<number>()
        for (const g of gRes.data ?? []) {
          groupIds.add(g.id)
          const tRes = await listTeams(g.id)
          divTeams.push(...(tRes.data ?? []))
        }

        // Count umpire assignments for teams in this division
        const counts = new Map<number, number>()
        for (const t of divTeams) counts.set(t.id, 0)

        for (const m of allMatches) {
          if (m.umpireTeam1Id && counts.has(m.umpireTeam1Id)) {
            counts.set(m.umpireTeam1Id, (counts.get(m.umpireTeam1Id) ?? 0) + 1)
          }
          if (m.umpireTeam2Id && counts.has(m.umpireTeam2Id)) {
            counts.set(m.umpireTeam2Id, (counts.get(m.umpireTeam2Id) ?? 0) + 1)
          }
        }

        data.push({ division: div, teams: divTeams, umpireCounts: counts })
      }
      setDivisionData(data)
    }
    load()
  }, [tournamentId])

  return (
    <div>
      <TournamentNav tournamentId={String(tournamentId)} />
      <div className="max-w-5xl mx-auto mt-6">
        <h2 className="text-xl font-bold mb-4">Umpire Overview</h2>

        {divisionData.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No divisions found.</p>
        )}

        <div className="space-y-6">
          {divisionData.map(({ division, teams, umpireCounts }) => {
            const counts = teams.map(t => umpireCounts.get(t.id) ?? 0)
            const maxCount = Math.max(...counts, 0)
            const minCount = Math.min(...counts, 0)
            const imbalanced = maxCount - minCount > 1

            return (
              <Card key={division.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {division.name}
                    {imbalanced && <span className="text-destructive text-sm">(imbalanced)</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-center">Umpire Assignments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teams.map((t) => {
                        const count = umpireCounts.get(t.id) ?? 0
                        const highlight = maxCount - minCount > 1 && (count === maxCount || count === minCount)
                        return (
                          <TableRow key={t.id} className={highlight ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                            <TableCell>{t.name}</TableCell>
                            <TableCell className="text-center font-mono">{count}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
