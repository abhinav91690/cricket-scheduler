"use server"

import { db } from "@/lib/db/connection"
import { teams, teamConflicts, matches } from "@/lib/db/schema"
import { eq, or } from "drizzle-orm"

export async function createTeam(data: { groupId: number; name: string }) {
  if (!data.name || !data.name.trim()) {
    return { error: "Name is required" }
  }

  const [result] = await db
    .insert(teams)
    .values({
      groupId: data.groupId,
      name: data.name.trim(),
    })
    .returning()

  return { data: result }
}

export async function updateTeam(
  id: number,
  data: Partial<{ name: string }>
) {
  if (data.name !== undefined && !data.name.trim()) {
    return { error: "Name cannot be empty" }
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name.trim()

  if (Object.keys(updateData).length === 0) {
    return { error: "No fields to update" }
  }

  const [result] = await db
    .update(teams)
    .set(updateData)
    .where(eq(teams.id, id))
    .returning()

  if (!result) {
    return { error: "Team not found" }
  }

  return { data: result }
}

export async function deleteTeam(id: number) {
  const [team] = await db.select().from(teams).where(eq(teams.id, id))

  if (!team) {
    return { error: "Team not found" }
  }

  // Check for scheduled matches involving this team
  const scheduledMatches = await db
    .select()
    .from(matches)
    .where(or(eq(matches.teamAId, id), eq(matches.teamBId, id)))

  if (scheduledMatches.length > 0) {
    return {
      error: "Cannot delete team with scheduled matches",
      matches: scheduledMatches,
    }
  }

  // Delete associated team conflicts
  await db
    .delete(teamConflicts)
    .where(
      or(eq(teamConflicts.teamAId, id), eq(teamConflicts.teamBId, id))
    )

  // Delete the team
  await db.delete(teams).where(eq(teams.id, id))

  return { data: { id } }
}

export async function listTeams(groupId: number) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.groupId, groupId))

  return { data: result }
}
