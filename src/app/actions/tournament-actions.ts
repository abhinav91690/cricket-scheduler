"use server"

import { db } from "@/lib/db/connection"
import {
  tournaments,
  divisions,
  groups,
  teams,
  teamConflicts,
  grounds,
  gameDays,
  timeSlots,
  matches,
} from "@/lib/db/schema"
import { eq, inArray, or } from "drizzle-orm"

export async function createTournament(data: {
  name: string
  season: string
  leatherGameDurationMin?: number
  tapeBallGameDurationMin?: number
  leatherQualifierCount?: number
  tapeBallQualifierCount?: number
}) {
  if (!data.name || !data.name.trim()) {
    return { error: "Name is required" }
  }
  if (!data.season || !data.season.trim()) {
    return { error: "Season is required" }
  }

  const [result] = await db
    .insert(tournaments)
    .values({
      name: data.name.trim(),
      season: data.season.trim(),
      ...(data.leatherGameDurationMin !== undefined && {
        leatherGameDurationMin: data.leatherGameDurationMin,
      }),
      ...(data.tapeBallGameDurationMin !== undefined && {
        tapeBallGameDurationMin: data.tapeBallGameDurationMin,
      }),
      ...(data.leatherQualifierCount !== undefined && {
        leatherQualifierCount: data.leatherQualifierCount,
      }),
      ...(data.tapeBallQualifierCount !== undefined && {
        tapeBallQualifierCount: data.tapeBallQualifierCount,
      }),
    })
    .returning()

  return { data: result }
}

export async function updateTournament(
  id: number,
  data: Partial<{
    name: string
    season: string
    leatherGameDurationMin: number
    tapeBallGameDurationMin: number
    leatherQualifierCount: number
    tapeBallQualifierCount: number
  }>
) {
  if (data.name !== undefined && !data.name.trim()) {
    return { error: "Name cannot be empty" }
  }
  if (data.season !== undefined && !data.season.trim()) {
    return { error: "Season cannot be empty" }
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name.trim()
  if (data.season !== undefined) updateData.season = data.season.trim()
  if (data.leatherGameDurationMin !== undefined)
    updateData.leatherGameDurationMin = data.leatherGameDurationMin
  if (data.tapeBallGameDurationMin !== undefined)
    updateData.tapeBallGameDurationMin = data.tapeBallGameDurationMin
  if (data.leatherQualifierCount !== undefined)
    updateData.leatherQualifierCount = data.leatherQualifierCount
  if (data.tapeBallQualifierCount !== undefined)
    updateData.tapeBallQualifierCount = data.tapeBallQualifierCount

  if (Object.keys(updateData).length === 0) {
    return { error: "No fields to update" }
  }

  const [result] = await db
    .update(tournaments)
    .set(updateData)
    .where(eq(tournaments.id, id))
    .returning()

  if (!result) {
    return { error: "Tournament not found" }
  }

  return { data: result }
}

export async function deleteTournament(id: number) {
  // Verify tournament exists
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id))

  if (!tournament) {
    return { error: "Tournament not found" }
  }

  // Get all division IDs for this tournament
  const divisionRows = await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(eq(divisions.tournamentId, id))
  const divisionIds = divisionRows.map((d) => d.id)

  // Get all group IDs for these divisions
  let groupIds: number[] = []
  if (divisionIds.length > 0) {
    const groupRows = await db
      .select({ id: groups.id })
      .from(groups)
      .where(inArray(groups.divisionId, divisionIds))
    groupIds = groupRows.map((g) => g.id)
  }

  // Get all team IDs for these groups
  let teamIds: number[] = []
  if (groupIds.length > 0) {
    const teamRows = await db
      .select({ id: teams.id })
      .from(teams)
      .where(inArray(teams.groupId, groupIds))
    teamIds = teamRows.map((t) => t.id)
  }

  // Get all game day IDs for this tournament
  const gameDayRows = await db
    .select({ id: gameDays.id })
    .from(gameDays)
    .where(eq(gameDays.tournamentId, id))
  const gameDayIds = gameDayRows.map((gd) => gd.id)

  // 1. Delete matches where groupId in groups of this tournament
  if (groupIds.length > 0) {
    await db.delete(matches).where(inArray(matches.groupId, groupIds))
  }

  // 2. Delete timeSlots where gameDayId in gameDays of this tournament
  if (gameDayIds.length > 0) {
    await db
      .delete(timeSlots)
      .where(inArray(timeSlots.gameDayId, gameDayIds))
  }

  // 3. Delete teamConflicts where teamAId or teamBId in teams
  if (teamIds.length > 0) {
    await db
      .delete(teamConflicts)
      .where(
        or(
          inArray(teamConflicts.teamAId, teamIds),
          inArray(teamConflicts.teamBId, teamIds)
        )
      )
  }

  // 4. Delete teams in groups of divisions
  if (groupIds.length > 0) {
    await db.delete(teams).where(inArray(teams.groupId, groupIds))
  }

  // 5. Delete groups in divisions
  if (divisionIds.length > 0) {
    await db.delete(groups).where(inArray(groups.divisionId, divisionIds))
  }

  // 6. Delete gameDays of tournament
  await db.delete(gameDays).where(eq(gameDays.tournamentId, id))

  // 7. Delete grounds of tournament
  await db.delete(grounds).where(eq(grounds.tournamentId, id))

  // 8. Delete divisions of tournament
  await db.delete(divisions).where(eq(divisions.tournamentId, id))

  // 9. Delete tournament
  await db.delete(tournaments).where(eq(tournaments.id, id))

  return { data: { id } }
}

export async function getTournament(id: number) {
  const [result] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id))

  if (!result) {
    return { error: "Tournament not found" }
  }

  return { data: result }
}

export async function listTournaments() {
  const result = await db.select().from(tournaments)
  return { data: result }
}
