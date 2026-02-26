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
  /** team → total scheduled match count (for round-robin fairness) */
  teamTotalMatchCounts: Map<number, number>
  /** team → total expected matches in their group (for ratio-based cross-division fairness) */
  teamExpectedMatchCounts?: Map<number, number>
  /** date → number of matches already scheduled on that date (O(1) day load lookup) */
  dayMatchCounts?: Map<string, number>
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
 * - +50 per unit above the division minimum for each team (round-robin fairness)
 *   When teamExpectedMatchCounts is provided, compares progress ratios (scheduled/expected)
 *   instead of raw counts, so teams in different-sized groups are compared fairly.
 *   Penalty = floor(excessRatio * 100) * 50 per team.
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

  // Round-robin fairness penalty (+50 per unit above division minimum)
  // When teamExpectedMatchCounts is provided, use progress ratios (scheduled/expected)
  // to fairly compare teams with different group sizes. Otherwise fall back to raw counts.
  if (ctx.teamTotalMatchCounts.size > 0) {
    if (ctx.teamExpectedMatchCounts && ctx.teamExpectedMatchCounts.size > 0) {
      // Ratio-based: compare scheduling progress as percentages
      const ratios: number[] = []
      for (const [teamId, scheduled] of ctx.teamTotalMatchCounts) {
        const expected = ctx.teamExpectedMatchCounts.get(teamId) ?? 1
        ratios.push(expected > 0 ? scheduled / expected : 0)
      }
      const minRatio = Math.min(...ratios)

      const teamAExpected = ctx.teamExpectedMatchCounts.get(match.teamAId) ?? 1
      const teamBExpected = ctx.teamExpectedMatchCounts.get(match.teamBId) ?? 1
      const teamAScheduled = ctx.teamTotalMatchCounts.get(match.teamAId) ?? 0
      const teamBScheduled = ctx.teamTotalMatchCounts.get(match.teamBId) ?? 0
      const teamARatio = teamAExpected > 0 ? teamAScheduled / teamAExpected : 0
      const teamBRatio = teamBExpected > 0 ? teamBScheduled / teamBExpected : 0

      // Convert excess ratio to integer "percentage points" to keep penalty granular
      score += Math.floor(Math.max(0, teamARatio - minRatio) * 100) * 50
      score += Math.floor(Math.max(0, teamBRatio - minRatio) * 100) * 50
    } else {
      // Raw count fallback (backward compatible)
      const minCount = Math.min(...ctx.teamTotalMatchCounts.values())
      const teamATotal = ctx.teamTotalMatchCounts.get(match.teamAId) ?? 0
      const teamBTotal = ctx.teamTotalMatchCounts.get(match.teamBId) ?? 0
      score += Math.max(0, teamATotal - minCount) * 50
      score += Math.max(0, teamBTotal - minCount) * 50
    }
  }

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
  // Use pre-computed dayMatchCounts for O(1) lookup when available
  const dayLoad = ctx.dayMatchCounts
    ? (ctx.dayMatchCounts.get(slot.date) ?? 0)
    : getDayMatchCount(ctx.occupancy, ctx.allSlots, slot.date)
  score += dayLoad

  return score
}
