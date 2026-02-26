"use server"

import { db } from "@/lib/db/connection"
import { teamConflicts, teams, groups, divisions } from "@/lib/db/schema"
import { eq, and, inArray, or } from "drizzle-orm"

export async function createConflict(data: {
  teamAId: number
  teamBId: number
  level: "same_slot" | "same_day"
}) {
  // Validate level enum
  if (data.level !== "same_slot" && data.level !== "same_day") {
    return { error: 'Level must be "same_slot" or "same_day"' }
  }

  // Enforce canonical ordering: teamAId < teamBId
  let teamAId = data.teamAId
  let teamBId = data.teamBId
  if (teamAId > teamBId) {
    ;[teamAId, teamBId] = [teamBId, teamAId]
  }

  if (teamAId === teamBId) {
    return { error: "Cannot create a conflict between a team and itself" }
  }

  // Validate both teams exist and get their groupIds
  const [teamA] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamAId))
  if (!teamA) {
    return { error: `Team with id ${teamAId} not found` }
  }

  const [teamB] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamBId))
  if (!teamB) {
    return { error: `Team with id ${teamBId} not found` }
  }

  // Validate teams are in different groups
  if (teamA.groupId === teamB.groupId) {
    return { error: "Conflict teams must be in different groups" }
  }

  const [result] = await db
    .insert(teamConflicts)
    .values({
      teamAId,
      teamBId,
      level: data.level,
    })
    .returning()

  return { data: result }
}

export async function updateConflictLevel(
  id: number,
  level: "same_slot" | "same_day"
) {
  // Validate level enum
  if (level !== "same_slot" && level !== "same_day") {
    return { error: 'Level must be "same_slot" or "same_day"' }
  }

  const [result] = await db
    .update(teamConflicts)
    .set({ level })
    .where(eq(teamConflicts.id, id))
    .returning()

  if (!result) {
    return { error: "Conflict not found" }
  }

  return { data: result }
}

export async function deleteConflict(id: number) {
  const [conflict] = await db
    .select()
    .from(teamConflicts)
    .where(eq(teamConflicts.id, id))

  if (!conflict) {
    return { error: "Conflict not found" }
  }

  await db.delete(teamConflicts).where(eq(teamConflicts.id, id))

  return { data: { id } }
}

export async function listConflicts(tournamentId: number) {
  // Get all division IDs for this tournament
  const divisionRows = await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(eq(divisions.tournamentId, tournamentId))
  const divisionIds = divisionRows.map((d) => d.id)

  if (divisionIds.length === 0) {
    return { data: [] }
  }

  // Get all group IDs for these divisions
  const groupRows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(inArray(groups.divisionId, divisionIds))
  const groupIds = groupRows.map((g) => g.id)

  if (groupIds.length === 0) {
    return { data: [] }
  }

  // Get all team IDs for these groups
  const teamRows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(inArray(teams.groupId, groupIds))
  const teamIds = teamRows.map((t) => t.id)

  if (teamIds.length === 0) {
    return { data: [] }
  }

  // Get all conflicts where either team is in this tournament
  const result = await db
    .select()
    .from(teamConflicts)
    .where(
      or(
        inArray(teamConflicts.teamAId, teamIds),
        inArray(teamConflicts.teamBId, teamIds)
      )
    )

  return { data: result }
}
