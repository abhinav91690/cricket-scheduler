"use server"

import { db } from "@/lib/db/connection"
import { teams, groups, divisions } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"

export interface TeamWithContext {
  id: number
  name: string
  groupId: number
  groupName: string
  format: string
  divisionName: string
}

export async function listAllTeamsForTournament(tournamentId: number): Promise<{ data: TeamWithContext[] }> {
  const divRows = await db.select().from(divisions).where(eq(divisions.tournamentId, tournamentId))
  if (divRows.length === 0) return { data: [] }

  const divMap = new Map(divRows.map(d => [d.id, d]))
  const divIds = divRows.map(d => d.id)

  const groupRows = await db.select().from(groups).where(inArray(groups.divisionId, divIds))
  if (groupRows.length === 0) return { data: [] }

  const groupMap = new Map(groupRows.map(g => [g.id, g]))
  const groupIds = groupRows.map(g => g.id)

  const teamRows = await db.select().from(teams).where(inArray(teams.groupId, groupIds))

  return {
    data: teamRows.map(t => {
      const group = groupMap.get(t.groupId)!
      const div = divMap.get(group.divisionId)!
      return {
        id: t.id,
        name: t.name,
        groupId: t.groupId,
        groupName: group.name,
        format: group.format,
        divisionName: div.name,
      }
    }).sort((a, b) => a.divisionName.localeCompare(b.divisionName) || a.groupName.localeCompare(b.groupName) || a.name.localeCompare(b.name)),
  }
}
