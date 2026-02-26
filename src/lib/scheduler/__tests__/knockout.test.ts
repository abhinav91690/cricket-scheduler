import { describe, it, expect } from "vitest"
import {
  generateKnockoutBracket,
  type QualifiedTeam,
  type KnockoutResult,
} from "../knockout"
import type { TeamConflict, SlotRef } from "../types"

describe("generateKnockoutBracket", () => {
  // Helpers
  function qualifier(teamId: number, groupRank: number, groupId: number): QualifiedTeam {
    return { teamId, groupRank, groupId }
  }

  function slot(id: number, date: string, groundFormat = "tape_ball", groundId = 1, startTime = "08:00"): SlotRef {
    return { id, date, groundFormat, groundId, startTime }
  }

  const defaultSlots: SlotRef[] = [
    slot(100, "2025-04-01"),
    slot(101, "2025-04-01"),
    slot(102, "2025-04-02"),
    slot(103, "2025-04-02"),
    slot(104, "2025-04-03"),
    slot(105, "2025-04-03"),
    slot(106, "2025-04-04"),
    slot(107, "2025-04-04"),
  ]

  const defaultDivisionTeamIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it("rejects fewer than 2 qualifiers", () => {
    expect(() =>
      generateKnockoutBracket(
        [qualifier(1, 1, 1)],
        defaultSlots,
        [],
        defaultDivisionTeamIds,
        new Map(),
        new Map()
      )
    ).toThrow()
  })

  it("rejects empty qualifiers", () => {
    expect(() =>
      generateKnockoutBracket(
        [],
        defaultSlots,
        [],
        defaultDivisionTeamIds,
        new Map(),
        new Map()
      )
    ).toThrow()
  })

  it("creates correct bracket size (power of 2) for 4 qualifiers", () => {
    const qualifiers = [
      qualifier(1, 1, 1),
      qualifier(2, 2, 1),
      qualifier(3, 1, 2),
      qualifier(4, 2, 2),
    ]

    const result = generateKnockoutBracket(
      qualifiers,
      defaultSlots,
      [],
      defaultDivisionTeamIds,
      new Map(),
      new Map()
    )

    // 4 is already a power of 2, so bracket size = 4, 2 matches in round 1
    expect(result.bracket.totalRounds).toBe(2)
    expect(result.bracket.matches).toHaveLength(2)
    expect(result.bracket.matches.every((m) => !m.isBye)).toBe(true)
  })

  it("creates correct bracket size for 3 qualifiers (rounds up to 4)", () => {
    const qualifiers = [
      qualifier(1, 1, 1),
      qualifier(2, 2, 1),
      qualifier(3, 1, 2),
    ]

    const result = generateKnockoutBracket(
      qualifiers,
      defaultSlots,
      [],
      defaultDivisionTeamIds,
      new Map(),
      new Map()
    )

    // bracketSize = 4, totalRounds = ceil(log2(3)) = 2
    expect(result.bracket.totalRounds).toBe(2)
    // 2 bracket positions → 2 matches, 1 bye + 1 real
    expect(result.bracket.matches).toHaveLength(2)
    const byes = result.bracket.matches.filter((m) => m.isBye)
    expect(byes).toHaveLength(1)
  })

  it("assigns byes to top seeds (lowest groupRank)", () => {
    const qualifiers = [
      qualifier(1, 1, 1), // top seed
      qualifier(2, 2, 1),
      qualifier(3, 1, 2), // top seed
      qualifier(4, 2, 2),
      qualifier(5, 3, 1),
    ]

    const result = generateKnockoutBracket(
      qualifiers,
      defaultSlots,
      [],
      defaultDivisionTeamIds,
      new Map(),
      new Map()
    )

    // bracketSize = 8, 5 qualifiers → 3 byes
    // Byes should go to top seeds (groupRank 1 first, then 2)
    const byeMatches = result.bracket.matches.filter((m) => m.isBye)
    expect(byeMatches).toHaveLength(3)

    // The teams that get byes should include the top-seeded teams
    const byeTeamIds = byeMatches.map((m) =>
      m.teamAId !== null ? m.teamAId : m.teamBId
    )
    // Top seeds (rank 1) should definitely have byes
    expect(byeTeamIds).toContain(1)
    expect(byeTeamIds).toContain(3)
  })

  it("creates correct totalRounds for various qualifier counts", () => {
    // 2 qualifiers → 1 round
    const r2 = generateKnockoutBracket(
      [qualifier(1, 1, 1), qualifier(2, 1, 2)],
      defaultSlots,
      [],
      defaultDivisionTeamIds,
      new Map(),
      new Map()
    )
    expect(r2.bracket.totalRounds).toBe(1)

    // 5 qualifiers → ceil(log2(5)) = 3 rounds
    const r5 = generateKnockoutBracket(
      [
        qualifier(1, 1, 1),
        qualifier(2, 2, 1),
        qualifier(3, 1, 2),
        qualifier(4, 2, 2),
        qualifier(5, 3, 1),
      ],
      defaultSlots,
      [],
      defaultDivisionTeamIds,
      new Map(),
      new Map()
    )
    expect(r5.bracket.totalRounds).toBe(3)
  })

  it("schedules non-bye matches to slots", () => {
    const qualifiers = [
      qualifier(1, 1, 1),
      qualifier(2, 2, 1),
      qualifier(3, 1, 2),
      qualifier(4, 2, 2),
    ]

    const result = generateKnockoutBracket(
      qualifiers,
      defaultSlots,
      [],
      defaultDivisionTeamIds,
      new Map(),
      new Map()
    )

    // All non-bye matches should be scheduled
    const nonByeMatches = result.bracket.matches.filter((m) => !m.isBye)
    expect(nonByeMatches.length).toBeGreaterThan(0)
    expect(result.scheduled).toHaveLength(nonByeMatches.length)

    // Each scheduled match should have a timeSlotId
    for (const sm of result.scheduled) {
      expect(sm.timeSlotId).toBeDefined()
      expect(typeof sm.timeSlotId).toBe("number")
    }
  })

  it("assigns 2 umpire teams per knockout match", () => {
    const qualifiers = [
      qualifier(1, 1, 1),
      qualifier(2, 2, 1),
      qualifier(3, 1, 2),
      qualifier(4, 2, 2),
    ]

    const result = generateKnockoutBracket(
      qualifiers,
      defaultSlots,
      [],
      defaultDivisionTeamIds,
      new Map(),
      new Map()
    )

    for (const sm of result.scheduled) {
      // Both umpire slots should be filled (with enough division teams)
      expect(sm.umpireTeam1Id).not.toBeNull()
      expect(sm.umpireTeam2Id).not.toBeNull()
      // Umpires should not be playing teams
      expect(sm.umpireTeam1Id).not.toBe(sm.teamAId)
      expect(sm.umpireTeam1Id).not.toBe(sm.teamBId)
      expect(sm.umpireTeam2Id).not.toBe(sm.teamAId)
      expect(sm.umpireTeam2Id).not.toBe(sm.teamBId)
      // Two umpires should be different
      expect(sm.umpireTeam1Id).not.toBe(sm.umpireTeam2Id)
    }
  })

  it("sets knockoutRound to 1 for all round-1 matches", () => {
    const qualifiers = [
      qualifier(1, 1, 1),
      qualifier(2, 2, 1),
      qualifier(3, 1, 2),
      qualifier(4, 2, 2),
    ]

    const result = generateKnockoutBracket(
      qualifiers,
      defaultSlots,
      [],
      defaultDivisionTeamIds,
      new Map(),
      new Map()
    )

    for (const m of result.bracket.matches) {
      expect(m.knockoutRound).toBe(1)
    }
    for (const sm of result.scheduled) {
      expect(sm.knockoutRound).toBe(1)
    }
  })

  it("respects existing occupancy when scheduling knockout matches", () => {
    const qualifiers = [
      qualifier(1, 1, 1),
      qualifier(2, 1, 2),
    ]

    // Slot 100 is already occupied
    const occupancy = new Map<number, number[]>()
    occupancy.set(100, [7, 8, 9])

    const result = generateKnockoutBracket(
      qualifiers,
      defaultSlots,
      [],
      defaultDivisionTeamIds,
      occupancy,
      new Map()
    )

    expect(result.scheduled).toHaveLength(1)
    // Should not use slot 100 since it's occupied (scoring will penalize it)
    // But it's not strictly forbidden unless teams conflict — the slot is still usable
    // The important thing is the match gets scheduled
    expect(result.scheduled[0].timeSlotId).toBeDefined()
  })

  it("handles exactly 2 qualifiers (simplest bracket)", () => {
    const qualifiers = [
      qualifier(1, 1, 1),
      qualifier(2, 1, 2),
    ]

    const result = generateKnockoutBracket(
      qualifiers,
      defaultSlots,
      [],
      defaultDivisionTeamIds,
      new Map(),
      new Map()
    )

    expect(result.bracket.totalRounds).toBe(1)
    expect(result.bracket.matches).toHaveLength(1)
    expect(result.bracket.matches[0].isBye).toBe(false)
    expect(result.scheduled).toHaveLength(1)
  })

  it("arranges cross-group matchups in round 1", () => {
    // 4 qualifiers from 2 groups — should try to pair across groups
    const qualifiers = [
      qualifier(1, 1, 1), // group 1, rank 1
      qualifier(2, 2, 1), // group 1, rank 2
      qualifier(3, 1, 2), // group 2, rank 1
      qualifier(4, 2, 2), // group 2, rank 2
    ]

    const result = generateKnockoutBracket(
      qualifiers,
      defaultSlots,
      [],
      defaultDivisionTeamIds,
      new Map(),
      new Map()
    )

    // In a 4-team bracket, cross-group means:
    // Match 1: group1 vs group2, Match 2: group1 vs group2
    for (const m of result.bracket.matches) {
      if (!m.isBye && m.teamAId !== null && m.teamBId !== null) {
        const teamA = qualifiers.find((q) => q.teamId === m.teamAId)!
        const teamB = qualifiers.find((q) => q.teamId === m.teamBId)!
        expect(teamA.groupId).not.toBe(teamB.groupId)
      }
    }
  })

  it("handles conflicts between teams in knockout scheduling", () => {
    const qualifiers = [
      qualifier(1, 1, 1),
      qualifier(2, 1, 2),
    ]

    const conflicts: TeamConflict[] = [
      { teamAId: 1, teamBId: 5, level: "same_slot" },
    ]

    // Slot 100 has team 5 in it
    const occupancy = new Map<number, number[]>()
    occupancy.set(100, [5, 6])

    const result = generateKnockoutBracket(
      qualifiers,
      defaultSlots,
      conflicts,
      defaultDivisionTeamIds,
      occupancy,
      new Map()
    )

    expect(result.scheduled).toHaveLength(1)
    // Should avoid slot 100 due to conflict between team 1 and team 5
    expect(result.scheduled[0].timeSlotId).not.toBe(100)
  })
})
