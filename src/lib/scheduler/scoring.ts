/**
 * Context object for scoring a slot. Bundles all tracking maps needed
 * to evaluate fairness across multiple dimensions.
 */
export interface ScoreContext {
  teamDayCounts: Map<number, Map<string, number>>
  umpireCounts: Map<number, number>
  occupancy: Map<number, number[]>
  allSlots: Array<{ id: number; date: string }>
  /** team → groundId → count of matches on that ground */
  teamGroundCounts: Map<number, Map<number, number>>
  /** team → startTime → count of matches at that time */
  teamTimeCounts: Map<number, Map<string, number>>
}

/**
 * Counts the number of matches on a given date across all slots in the occupancy map.
 * Each occupied slot (with at least one team) counts as one match.
 */
export function getDayMatchCount(
  occupancy: Map<number, number[]>,
  allSlots: Array<{ id: number; date: string }>,
  date: string
): number {
  let count = 0
  for (const slot of allSlots) {
    if (slot.date === date) {
      const teams = occupancy.get(slot.id)
      if (teams && teams.length > 0) {
        count++
      }
    }
  }
  return count
}

/**
 * Scores how good a time slot is for a match. Lower score = better.
 *
 * Penalty weights:
 * - +10 per existing match for each team on that day (date spread)
 * - +8  per existing match for each team on that ground (ground fairness)
 * - +8  per existing match for each team at that start time (time-of-day fairness)
 * - +1  per existing match on that day across all slots (day load balancing)
 */
export function scoreSlot(
  slot: { id: number; date: string; groundId?: number; startTime?: string },
  match: { teamAId: number; teamBId: number },
  ctx: ScoreContext
): number {
  let score = 0

  // Date spread penalty (+10 per team per existing match on this date)
  const teamADayCount = ctx.teamDayCounts.get(match.teamAId)?.get(slot.date) ?? 0
  const teamBDayCount = ctx.teamDayCounts.get(match.teamBId)?.get(slot.date) ?? 0
  score += teamADayCount * 10
  score += teamBDayCount * 10

  // Ground fairness penalty (+8 per team per existing match on this ground)
  if (slot.groundId != null) {
    const teamAGroundCount = ctx.teamGroundCounts.get(match.teamAId)?.get(slot.groundId) ?? 0
    const teamBGroundCount = ctx.teamGroundCounts.get(match.teamBId)?.get(slot.groundId) ?? 0
    score += teamAGroundCount * 8
    score += teamBGroundCount * 8
  }

  // Time-of-day fairness penalty (+8 per team per existing match at this start time)
  if (slot.startTime != null) {
    const teamATimeCount = ctx.teamTimeCounts.get(match.teamAId)?.get(slot.startTime) ?? 0
    const teamBTimeCount = ctx.teamTimeCounts.get(match.teamBId)?.get(slot.startTime) ?? 0
    score += teamATimeCount * 8
    score += teamBTimeCount * 8
  }

  // Day load balancing (+1 per existing match on this date)
  const dayLoad = getDayMatchCount(ctx.occupancy, ctx.allSlots, slot.date)
  score += dayLoad

  return score
}
