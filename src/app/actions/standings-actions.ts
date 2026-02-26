"use server"

import { db } from "@/lib/db/connection"
import { matches, teams, groups, divisions } from "@/lib/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { calculateStandings, type Standing } from "@/lib/scheduler/standings"

export interface GroupStandings {
  groupId: number
  groupName: string
  format: string
  divisionName: string
  standings: (Standing & { teamName: string })[]
}

export async function getStandingsForTournament(tournamentId: number): Promise<{ data: GroupStandings[] }> {
  const divRows = await db.select().from(divisions).where(eq(divisions.tournamentId, tournamentId))
  const result: GroupStandings[] = []

  for (const div of divRows) {
    const groupRows = await db.select().from(groups).where(eq(groups.divisionId, div.id))

    for (const group of groupRows) {
      const teamRows = await db.select().from(teams).where(eq(teams.groupId, group.id))
      const teamIds = teamRows.map(t => t.id)
      const teamNameMap = new Map(teamRows.map(t => [t.id, t.name]))

      if (teamIds.length === 0) continue

      const playedMatches = await db
        .select()
        .from(matches)
        .where(and(eq(matches.groupId, group.id), eq(matches.status, "played")))

      const standings = calculateStandings(
        teamIds,
        playedMatches.map(m => ({
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          teamAScore: m.teamAScore ?? 0,
          teamBScore: m.teamBScore ?? 0,
          winnerId: m.winnerId,
          status: "played" as const,
        }))
      )

      result.push({
        groupId: group.id,
        groupName: group.name,
        format: group.format,
        divisionName: div.name,
        standings: standings.map(s => ({
          ...s,
          teamName: teamNameMap.get(s.teamId) ?? `Team ${s.teamId}`,
        })),
      })
    }
  }

  return { data: result }
}
