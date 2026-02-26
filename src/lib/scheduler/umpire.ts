import type { TeamConflict, OccupancyMap } from "./types"

/**
 * Selects the best umpire team for a match in a given slot.
 *
 * Filters division teams to eligible candidates (not playing, not in slot,
 * no conflict with either playing team), then picks the one with fewest
 * umpire assignments. Returns null if no valid candidate exists.
 */
export function selectUmpireTeam(
  slotId: number,
  match: { teamAId: number; teamBId: number },
  occupancy: OccupancyMap,
  umpireCounts: Map<number, number>,
  conflicts: TeamConflict[],
  divisionTeamIds: number[],
  matchFormat?: string,
  teamFormatMap?: Map<number, string>
): number | null {
  const teamsInSlot = occupancy.get(slotId) ?? []
  const playingTeams = [match.teamAId, match.teamBId]

  const candidates = divisionTeamIds.filter((id) => {
    // Not one of the playing teams
    if (playingTeams.includes(id)) return false

    // Not already in this slot (playing or umpiring)
    if (teamsInSlot.includes(id)) return false

    // Must be same format as the match
    if (matchFormat && teamFormatMap) {
      const teamFormat = teamFormatMap.get(id)
      if (teamFormat !== matchFormat) return false
    }

    // No conflict with either playing team (any level blocks)
    for (const conflict of conflicts) {
      for (const playingTeam of playingTeams) {
        const isConflict =
          (conflict.teamAId === id && conflict.teamBId === playingTeam) ||
          (conflict.teamBId === id && conflict.teamAId === playingTeam)
        if (isConflict) return false
      }
    }

    return true
  })

  if (candidates.length === 0) return null

  // Pick candidate with fewest umpire assignments
  candidates.sort(
    (a, b) => (umpireCounts.get(a) ?? 0) - (umpireCounts.get(b) ?? 0)
  )

  return candidates[0]
}
