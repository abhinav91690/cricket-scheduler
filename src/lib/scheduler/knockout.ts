import type { TeamConflict, SlotRef, OccupancyMap } from "./types"
import {
  isFormatCompatible,
  hasTeamConflictInSlot,
  isTeamAvailable,
} from "./constraints"
import { scoreSlot } from "./scoring"
import type { ScoreContext } from "./scoring"
import { selectUmpireTeam } from "./umpire"

export interface QualifiedTeam {
  teamId: number
  groupRank: number
  groupId: number
}

export interface KnockoutMatch {
  teamAId: number | null // null = bye
  teamBId: number | null // null = bye
  isBye: boolean
  knockoutRound: number
}

export interface KnockoutResult {
  bracket: { matches: KnockoutMatch[]; totalRounds: number }
  scheduled: Array<{
    teamAId: number
    teamBId: number
    timeSlotId: number
    umpireTeam1Id: number | null
    umpireTeam2Id: number | null
    knockoutRound: number
  }>
}

/**
 * Generates a single-elimination knockout bracket from qualified teams.
 *
 * 1. Reject if fewer than 2 qualifiers
 * 2. bracketSize = next power of 2 >= qualifiers.length
 * 3. totalRounds = ceil(log2(qualifiers.length))
 * 4. Seed teams by groupRank, arrange for cross-group matchups
 * 5. Assign byes to top seeds (lowest groupRank)
 * 6. Create round 1 matchups
 * 7. For non-bye matches: find best slot, assign 2 umpire teams
 * 8. Return bracket and scheduled matches
 */
export function generateKnockoutBracket(
  qualifiers: QualifiedTeam[],
  slots: SlotRef[],
  conflicts: TeamConflict[],
  divisionTeamIds: number[],
  occupancy: OccupancyMap,
  umpireCounts: Map<number, number>
): KnockoutResult {
  // 1. Reject if fewer than 2 qualifiers
  if (qualifiers.length < 2) {
    throw new Error("Knockout bracket requires at least 2 qualifiers")
  }

  // 2. Bracket size = next power of 2 >= qualifiers.length
  const bracketSize = nextPowerOf2(qualifiers.length)

  // 3. Total rounds
  const totalRounds = Math.ceil(Math.log2(qualifiers.length))

  // 4. Seed teams for cross-group matchups
  const seeded = seedForCrossGroup(qualifiers)

  // 5 & 6. Create round 1 matchups with byes for top seeds
  const byeCount = bracketSize - qualifiers.length
  const { matches, byeTeamIds } = createRound1Matches(seeded, bracketSize, byeCount)

  // 7. Schedule non-bye matches
  // Clone occupancy so we can update it as we assign slots
  const occ: OccupancyMap = new Map(
    Array.from(occupancy.entries()).map(([k, v]) => [k, [...v]])
  )
  const umpCounts = new Map(umpireCounts)

  const teamDayCounts = new Map<number, Map<string, number>>()
  const teamGroundCounts = new Map<number, Map<number, number>>()
  const teamTimeCounts = new Map<number, Map<string, number>>()

  const scheduled: KnockoutResult["scheduled"] = []

  for (const m of matches) {
    if (m.isBye || m.teamAId === null || m.teamBId === null) continue

    // Build a MatchRef-like object for constraint helpers
    const matchRef = {
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      groupId: 0, // knockout matches don't belong to a group
      format: slots.length > 0 ? slots[0].groundFormat : "tape_ball",
    }

    // Filter compatible slots
    const candidates = slots
      .filter((s) => isFormatCompatible(s, matchRef))
      .filter((s) => isTeamAvailable(s.id, matchRef, occ))
      .filter((s) => !hasTeamConflictInSlot(s.id, matchRef, occ, conflicts))

    if (candidates.length === 0) continue

    // Score and pick best
    const ctx: ScoreContext = {
      teamDayCounts,
      umpireCounts: umpCounts,
      occupancy: occ,
      allSlots: slots,
      teamGroundCounts,
      teamTimeCounts,
      teamTotalMatchCounts: new Map(),
    }
    const scored = candidates.map((s) => ({
      slot: s,
      score: scoreSlot(s, matchRef, ctx),
    }))
    scored.sort((a, b) => a.score - b.score)
    const bestSlot = scored[0].slot

    // Assign first umpire team
    const umpireTeam1Id = selectUmpireTeam(
      bestSlot.id,
      matchRef,
      occ,
      umpCounts,
      conflicts,
      divisionTeamIds
    )

    // Update occupancy with first umpire before selecting second
    if (!occ.has(bestSlot.id)) {
      occ.set(bestSlot.id, [])
    }
    const slotTeams = occ.get(bestSlot.id)!
    slotTeams.push(m.teamAId, m.teamBId)
    if (umpireTeam1Id != null) {
      slotTeams.push(umpireTeam1Id)
      umpCounts.set(umpireTeam1Id, (umpCounts.get(umpireTeam1Id) ?? 0) + 1)
    }

    // Assign second umpire team
    const umpireTeam2Id = selectUmpireTeam(
      bestSlot.id,
      matchRef,
      occ,
      umpCounts,
      conflicts,
      divisionTeamIds
    )
    if (umpireTeam2Id != null) {
      slotTeams.push(umpireTeam2Id)
      umpCounts.set(umpireTeam2Id, (umpCounts.get(umpireTeam2Id) ?? 0) + 1)
    }

    // Update team day/ground/time counts
    for (const teamId of [m.teamAId, m.teamBId]) {
      if (!teamDayCounts.has(teamId)) {
        teamDayCounts.set(teamId, new Map())
      }
      const dayCounts = teamDayCounts.get(teamId)!
      dayCounts.set(bestSlot.date, (dayCounts.get(bestSlot.date) ?? 0) + 1)

      if (!teamGroundCounts.has(teamId)) {
        teamGroundCounts.set(teamId, new Map())
      }
      const groundCounts = teamGroundCounts.get(teamId)!
      groundCounts.set(bestSlot.groundId, (groundCounts.get(bestSlot.groundId) ?? 0) + 1)

      if (!teamTimeCounts.has(teamId)) {
        teamTimeCounts.set(teamId, new Map())
      }
      const timeCounts = teamTimeCounts.get(teamId)!
      timeCounts.set(bestSlot.startTime, (timeCounts.get(bestSlot.startTime) ?? 0) + 1)
    }

    scheduled.push({
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      timeSlotId: bestSlot.id,
      umpireTeam1Id,
      umpireTeam2Id,
      knockoutRound: 1,
    })
  }

  return {
    bracket: { matches, totalRounds },
    scheduled,
  }
}

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

/**
 * Seeds qualifiers for cross-group matchups.
 * Sort by groupRank ascending, then interleave groups so that
 * same-group teams are placed far apart in the bracket.
 */
function seedForCrossGroup(qualifiers: QualifiedTeam[]): QualifiedTeam[] {
  // Sort by groupRank first (best rank = lowest number)
  const sorted = [...qualifiers].sort((a, b) => {
    if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank
    return a.groupId - b.groupId
  })

  // Group by groupId
  const byGroup = new Map<number, QualifiedTeam[]>()
  for (const q of sorted) {
    if (!byGroup.has(q.groupId)) byGroup.set(q.groupId, [])
    byGroup.get(q.groupId)!.push(q)
  }

  const groupQueues = Array.from(byGroup.values())

  // Interleave: alternate picking from each group
  const seeded: QualifiedTeam[] = []
  let gi = 0
  while (seeded.length < qualifiers.length) {
    const queue = groupQueues[gi % groupQueues.length]
    if (queue.length > 0) {
      seeded.push(queue.shift()!)
    }
    gi++
    // Safety: if we've cycled through all groups without adding, break
    if (gi > qualifiers.length * groupQueues.length) break
  }

  return seeded
}

/**
 * Creates round 1 matchups. Top seeds get byes.
 * Seeded order is arranged so adjacent pairs form matches,
 * with byes placed at the end positions for top seeds.
 */
/**
 * Creates round 1 matchups. Top seeds get byes.
 * Bye-receiving teams are paired against null (auto-advance).
 * Remaining teams are paired against each other.
 */
function createRound1Matches(
  seeded: QualifiedTeam[],
  bracketSize: number,
  byeCount: number
): { matches: KnockoutMatch[]; byeTeamIds: number[] } {
  const byeReceivers = seeded.slice(0, byeCount)
  const nonByeTeams = seeded.slice(byeCount)
  const byeTeamIds = byeReceivers.map((q) => q.teamId)

  const matches: KnockoutMatch[] = []

  // Create bye matches: each bye receiver advances automatically
  for (const receiver of byeReceivers) {
    matches.push({
      teamAId: receiver.teamId,
      teamBId: null,
      isBye: true,
      knockoutRound: 1,
    })
  }

  // Create real matches from remaining teams (paired sequentially)
  for (let i = 0; i < nonByeTeams.length; i += 2) {
    const a = nonByeTeams[i]
    const b = nonByeTeams[i + 1]
    if (a && b) {
      matches.push({
        teamAId: a.teamId,
        teamBId: b.teamId,
        isBye: false,
        knockoutRound: 1,
      })
    }
  }

  return { matches, byeTeamIds }
}
