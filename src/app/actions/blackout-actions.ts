"use server"

import { db } from "@/lib/db/connection"
import { teamBlackoutDates, teams, groups, divisions } from "@/lib/db/schema"
import { eq, inArray, and } from "drizzle-orm"

export async function listBlackouts(tournamentId: number) {
  const divisionRows = await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(eq(divisions.tournamentId, tournamentId))
  const divisionIds = divisionRows.map((d) => d.id)
  if (divisionIds.length === 0) return { data: [] }

  const groupRows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(inArray(groups.divisionId, divisionIds))
  const groupIds = groupRows.map((g) => g.id)
  if (groupIds.length === 0) return { data: [] }

  const teamRows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(inArray(teams.groupId, groupIds))
  const teamIds = teamRows.map((t) => t.id)
  if (teamIds.length === 0) return { data: [] }

  const result = await db
    .select()
    .from(teamBlackoutDates)
    .where(inArray(teamBlackoutDates.teamId, teamIds))

  return { data: result }
}

export async function createBlackout(data: { teamId: number; date: string }) {
  if (!data.teamId || !data.date) {
    return { error: "Team and date are required" }
  }

  const [result] = await db
    .insert(teamBlackoutDates)
    .values({ teamId: data.teamId, date: data.date })
    .returning()

  return { data: result }
}

export async function deleteBlackout(id: number) {
  const [row] = await db
    .select()
    .from(teamBlackoutDates)
    .where(eq(teamBlackoutDates.id, id))

  if (!row) return { error: "Blackout not found" }

  await db.delete(teamBlackoutDates).where(eq(teamBlackoutDates.id, id))
  return { data: { id } }
}
