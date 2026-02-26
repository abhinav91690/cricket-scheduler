"use server"

import { db } from "@/lib/db/connection"
import { divisions, groups, teams } from "@/lib/db/schema"

export interface ImportGroup {
  name: string
  format: "leather" | "tape_ball"
  teams: string[]
}

export interface ImportDivision {
  name: string
  tier: number
  groups: ImportGroup[]
}

export interface ImportPayload {
  divisions: ImportDivision[]
}

export async function importStructure(tournamentId: number, payload: ImportPayload) {
  const errors: string[] = []

  // Validate
  if (!payload.divisions || !Array.isArray(payload.divisions)) {
    return { error: "Invalid payload: 'divisions' must be an array" }
  }

  for (let di = 0; di < payload.divisions.length; di++) {
    const div = payload.divisions[di]
    if (!div.name?.trim()) errors.push(`Division ${di + 1}: name is required`)
    if (!Number.isInteger(div.tier) || div.tier < 1 || div.tier > 4) {
      errors.push(`Division "${div.name || di + 1}": tier must be 1-4`)
    }
    if (!Array.isArray(div.groups)) {
      errors.push(`Division "${div.name || di + 1}": groups must be an array`)
      continue
    }
    for (let gi = 0; gi < div.groups.length; gi++) {
      const grp = div.groups[gi]
      if (!grp.name?.trim()) errors.push(`Division "${div.name}", Group ${gi + 1}: name is required`)
      if (grp.format !== "leather" && grp.format !== "tape_ball") {
        errors.push(`Division "${div.name}", Group "${grp.name || gi + 1}": format must be "leather" or "tape_ball"`)
      }
      if (!Array.isArray(grp.teams)) {
        errors.push(`Division "${div.name}", Group "${grp.name || gi + 1}": teams must be an array`)
        continue
      }
      for (let ti = 0; ti < grp.teams.length; ti++) {
        if (!grp.teams[ti]?.trim()) {
          errors.push(`Division "${div.name}", Group "${grp.name}", Team ${ti + 1}: name is required`)
        }
      }
    }
  }

  if (errors.length > 0) {
    return { error: `Validation failed:\n${errors.join("\n")}` }
  }

  // Insert everything
  let divCount = 0
  let groupCount = 0
  let teamCount = 0

  for (const div of payload.divisions) {
    const [divRow] = await db.insert(divisions).values({
      tournamentId,
      tier: div.tier,
      name: div.name.trim(),
    }).returning()
    divCount++

    for (const grp of div.groups) {
      const [grpRow] = await db.insert(groups).values({
        divisionId: divRow.id,
        format: grp.format,
        name: grp.name.trim(),
      }).returning()
      groupCount++

      for (const teamName of grp.teams) {
        await db.insert(teams).values({
          groupId: grpRow.id,
          name: teamName.trim(),
        })
        teamCount++
      }
    }
  }

  return {
    data: {
      divisions: divCount,
      groups: groupCount,
      teams: teamCount,
    },
  }
}
