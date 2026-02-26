"use server"

import { db } from "@/lib/db/connection"
import {
  divisions,
  groups,
  teams,
  teamConflicts,
  matches,
} from "@/lib/db/schema"
import { eq, inArray, or } from "drizzle-orm"

// --- Division CRUD ---

export async function createDivision(data: {
  tournamentId: number
  tier: number
  name: string
}) {
  if (!data.name || !data.name.trim()) {
    return { error: "Name is required" }
  }
  if (!Number.isInteger(data.tier) || data.tier < 1 || data.tier > 4) {
    return { error: "Tier must be an integer between 1 and 4" }
  }

  const [result] = await db
    .insert(divisions)
    .values({
      tournamentId: data.tournamentId,
      tier: data.tier,
      name: data.name.trim(),
    })
    .returning()

  return { data: result }
}

export async function updateDivision(
  id: number,
  data: Partial<{ tier: number; name: string }>
) {
  if (data.name !== undefined && !data.name.trim()) {
    return { error: "Name cannot be empty" }
  }
  if (
    data.tier !== undefined &&
    (!Number.isInteger(data.tier) || data.tier < 1 || data.tier > 4)
  ) {
    return { error: "Tier must be an integer between 1 and 4" }
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name.trim()
  if (data.tier !== undefined) updateData.tier = data.tier

  if (Object.keys(updateData).length === 0) {
    return { error: "No fields to update" }
  }

  const [result] = await db
    .update(divisions)
    .set(updateData)
    .where(eq(divisions.id, id))
    .returning()

  if (!result) {
    return { error: "Division not found" }
  }

  return { data: result }
}

export async function deleteDivision(id: number) {
  const [division] = await db
    .select()
    .from(divisions)
    .where(eq(divisions.id, id))

  if (!division) {
    return { error: "Division not found" }
  }

  // Get all group IDs for this division
  const groupRows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(eq(groups.divisionId, id))
  const groupIds = groupRows.map((g) => g.id)

  // Get all team IDs for these groups
  let teamIds: number[] = []
  if (groupIds.length > 0) {
    const teamRows = await db
      .select({ id: teams.id })
      .from(teams)
      .where(inArray(teams.groupId, groupIds))
    teamIds = teamRows.map((t) => t.id)
  }

  // Delete matches in groups of this division
  if (groupIds.length > 0) {
    await db.delete(matches).where(inArray(matches.groupId, groupIds))
  }

  // Delete team conflicts referencing teams in this division
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

  // Delete teams in groups of this division
  if (groupIds.length > 0) {
    await db.delete(teams).where(inArray(teams.groupId, groupIds))
  }

  // Delete groups in this division
  await db.delete(groups).where(eq(groups.divisionId, id))

  // Delete the division
  await db.delete(divisions).where(eq(divisions.id, id))

  return { data: { id } }
}

export async function listDivisions(tournamentId: number) {
  const result = await db
    .select()
    .from(divisions)
    .where(eq(divisions.tournamentId, tournamentId))

  return { data: result }
}

// --- Group CRUD ---

export async function createGroup(data: {
  divisionId: number
  format: "leather" | "tape_ball"
  name: string
}) {
  if (!data.name || !data.name.trim()) {
    return { error: "Name is required" }
  }
  if (data.format !== "leather" && data.format !== "tape_ball") {
    return { error: 'Format must be "leather" or "tape_ball"' }
  }

  const [result] = await db
    .insert(groups)
    .values({
      divisionId: data.divisionId,
      format: data.format,
      name: data.name.trim(),
    })
    .returning()

  return { data: result }
}

export async function updateGroup(
  id: number,
  data: Partial<{ format: "leather" | "tape_ball"; name: string }>
) {
  if (data.name !== undefined && !data.name.trim()) {
    return { error: "Name cannot be empty" }
  }
  if (
    data.format !== undefined &&
    data.format !== "leather" &&
    data.format !== "tape_ball"
  ) {
    return { error: 'Format must be "leather" or "tape_ball"' }
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name.trim()
  if (data.format !== undefined) updateData.format = data.format

  if (Object.keys(updateData).length === 0) {
    return { error: "No fields to update" }
  }

  const [result] = await db
    .update(groups)
    .set(updateData)
    .where(eq(groups.id, id))
    .returning()

  if (!result) {
    return { error: "Group not found" }
  }

  return { data: result }
}

export async function deleteGroup(id: number) {
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, id))

  if (!group) {
    return { error: "Group not found" }
  }

  // Get all team IDs for this group
  const teamRows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.groupId, id))
  const teamIds = teamRows.map((t) => t.id)

  // Delete matches in this group
  await db.delete(matches).where(eq(matches.groupId, id))

  // Delete team conflicts referencing teams in this group
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

  // Delete teams in this group
  await db.delete(teams).where(eq(teams.groupId, id))

  // Delete the group
  await db.delete(groups).where(eq(groups.id, id))

  return { data: { id } }
}

export async function listGroups(divisionId: number) {
  const result = await db
    .select()
    .from(groups)
    .where(eq(groups.divisionId, divisionId))

  return { data: result }
}
