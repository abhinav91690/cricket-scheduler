"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getStandingsForTournament, type GroupStandings } from "@/app/actions/standings-actions"
import { getTournament } from "@/app/actions/tournament-actions"
import { TournamentNav } from "@/components/nav"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function StandingsPage() {
  const params = useParams()
  const tournamentId = Number(params.id)
  const [groupStandings, setGroupStandings] = useState<GroupStandings[]>([])
  const [qualifierCounts, setQualifierCounts] = useState<{ leather: number; tapeBall: number }>({ leather: 8, tapeBall: 6 })

  useEffect(() => {
    getStandingsForTournament(tournamentId).then((r) => setGroupStandings(r.data))
    getTournament(tournamentId).then((r) => {
      if (r.data) {
        setQualifierCounts({
          leather: r.data.leatherQualifierCount,
          tapeBall: r.data.tapeBallQualifierCount,
        })
      }
    })
  }, [tournamentId])

  function getQualifierCount(format: string) {
    return format === "leather" ? qualifierCounts.leather : qualifierCounts.tapeBall
  }

  return (
    <div>
      <TournamentNav tournamentId={String(tournamentId)} />
      <div className="max-w-5xl mx-auto mt-6">
        <h2 className="text-xl font-bold mb-4">Group Standings</h2>

        {groupStandings.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No groups with teams found.</p>
        )}

        <div className="space-y-6">
          {groupStandings.map((gs) => {
            const qualCount = getQualifierCount(gs.format)
            return (
              <Card key={gs.groupId}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {gs.divisionName} — {gs.groupName}
                    <Badge variant={gs.format === "leather" ? "default" : "secondary"}>
                      {gs.format === "tape_ball" ? "Tape Ball" : "Leather"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-center">P</TableHead>
                        <TableHead className="text-center">W</TableHead>
                        <TableHead className="text-center">L</TableHead>
                        <TableHead className="text-center">T</TableHead>
                        <TableHead className="text-center">Pts</TableHead>
                        <TableHead className="text-center">NRR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gs.standings.map((s, idx) => {
                        const isPromotion = idx < qualCount
                        const isRelegation = idx >= gs.standings.length - 1 && gs.standings.length > qualCount
                        return (
                          <TableRow
                            key={s.teamId}
                            className={
                              isPromotion
                                ? "bg-green-50 dark:bg-green-950/20"
                                : isRelegation
                                  ? "bg-red-50 dark:bg-red-950/20"
                                  : ""
                            }
                          >
                            <TableCell className="font-medium">{idx + 1}</TableCell>
                            <TableCell>{s.teamName}</TableCell>
                            <TableCell className="text-center">{s.played}</TableCell>
                            <TableCell className="text-center">{s.won}</TableCell>
                            <TableCell className="text-center">{s.lost}</TableCell>
                            <TableCell className="text-center">{s.tied}</TableCell>
                            <TableCell className="text-center font-medium">{s.points}</TableCell>
                            <TableCell className="text-center">{s.netRunRate.toFixed(2)}</TableCell>
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
