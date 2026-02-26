import { describe, it, expect } from "vitest"
import { selectUmpireTeam } from "../umpire"
import type { TeamConflict, OccupancyMap } from "../types"

describe("selectUmpireTeam", () => {
  const divisionTeamIds = [1, 2, 3, 4, 5, 6]

  it("excludes playing teams from candidates", () => {
    const occupancy: OccupancyMap = new Map()
    const umpireCounts = new Map<number, number>()
    const result = selectUmpireTeam(
      10,
      { teamAId: 1, teamBId: 2 },
      occupancy,
      umpireCounts,
      [],
      divisionTeamIds
    )
    // Should pick from [3,4,5,6], not 1 or 2
    expect(result).not.toBe(1)
    expect(result).not.toBe(2)
    expect([3, 4, 5, 6]).toContain(result)
  })

  it("excludes teams already playing in the slot", () => {
    const occupancy: OccupancyMap = new Map([[10, [3, 4]]])
    const umpireCounts = new Map<number, number>()
    const result = selectUmpireTeam(
      10,
      { teamAId: 1, teamBId: 2 },
      occupancy,
      umpireCounts,
      [],
      divisionTeamIds
    )
    // 1,2 are playing teams; 3,4 are in slot occupancy → only 5,6 eligible
    expect([5, 6]).toContain(result)
  })

  it("excludes teams already umpiring in the slot", () => {
    // Team 3 is umpiring (in occupancy for this slot)
    const occupancy: OccupancyMap = new Map([[10, [3]]])
    const umpireCounts = new Map<number, number>()
    const result = selectUmpireTeam(
      10,
      { teamAId: 1, teamBId: 2 },
      occupancy,
      umpireCounts,
      [],
      divisionTeamIds
    )
    // 1,2 playing; 3 in occupancy → only 4,5,6 eligible
    expect([4, 5, 6]).toContain(result)
  })

  it("excludes teams with a same_slot conflict with either playing team", () => {
    const occupancy: OccupancyMap = new Map()
    const umpireCounts = new Map<number, number>()
    const conflicts: TeamConflict[] = [
      { teamAId: 1, teamBId: 3, level: "same_slot" },
    ]
    const result = selectUmpireTeam(
      10,
      { teamAId: 1, teamBId: 2 },
      occupancy,
      umpireCounts,
      conflicts,
      divisionTeamIds
    )
    // 1,2 playing; 3 has conflict with team 1 → only 4,5,6 eligible
    expect([4, 5, 6]).toContain(result)
  })

  it("excludes teams with a same_day conflict with either playing team", () => {
    const occupancy: OccupancyMap = new Map()
    const umpireCounts = new Map<number, number>()
    const conflicts: TeamConflict[] = [
      { teamAId: 2, teamBId: 4, level: "same_day" },
    ]
    const result = selectUmpireTeam(
      10,
      { teamAId: 1, teamBId: 2 },
      occupancy,
      umpireCounts,
      conflicts,
      divisionTeamIds
    )
    // 1,2 playing; 4 has same_day conflict with team 2 → only 3,5,6 eligible
    expect([3, 5, 6]).toContain(result)
  })

  it("picks the candidate with fewest umpire assignments", () => {
    const occupancy: OccupancyMap = new Map()
    const umpireCounts = new Map<number, number>([
      [3, 5],
      [4, 3],
      [5, 1],
      [6, 2],
    ])
    const result = selectUmpireTeam(
      10,
      { teamAId: 1, teamBId: 2 },
      occupancy,
      umpireCounts,
      [],
      divisionTeamIds
    )
    // Team 5 has fewest (1)
    expect(result).toBe(5)
  })

  it("picks candidate with 0 count when umpireCounts has no entry", () => {
    const occupancy: OccupancyMap = new Map()
    const umpireCounts = new Map<number, number>([
      [3, 2],
      [4, 1],
      // 5 and 6 not in map → count 0
    ])
    const result = selectUmpireTeam(
      10,
      { teamAId: 1, teamBId: 2 },
      occupancy,
      umpireCounts,
      [],
      divisionTeamIds
    )
    // 5 or 6 have 0 assignments
    expect([5, 6]).toContain(result)
  })

  it("returns null when no valid candidates exist", () => {
    // All non-playing teams are in the slot
    const occupancy: OccupancyMap = new Map([[10, [3, 4, 5, 6]]])
    const umpireCounts = new Map<number, number>()
    const result = selectUmpireTeam(
      10,
      { teamAId: 1, teamBId: 2 },
      occupancy,
      umpireCounts,
      [],
      divisionTeamIds
    )
    expect(result).toBeNull()
  })

  it("returns null when all candidates have conflicts", () => {
    const occupancy: OccupancyMap = new Map()
    const umpireCounts = new Map<number, number>()
    const conflicts: TeamConflict[] = [
      { teamAId: 1, teamBId: 3, level: "same_slot" },
      { teamAId: 1, teamBId: 4, level: "same_day" },
      { teamAId: 2, teamBId: 5, level: "same_slot" },
      { teamAId: 2, teamBId: 6, level: "same_day" },
    ]
    const result = selectUmpireTeam(
      10,
      { teamAId: 1, teamBId: 2 },
      occupancy,
      umpireCounts,
      conflicts,
      divisionTeamIds
    )
    expect(result).toBeNull()
  })

  it("handles combined exclusions correctly", () => {
    // Team 3 in slot, team 4 has conflict, team 5 has conflict → only 6 eligible
    const occupancy: OccupancyMap = new Map([[10, [3]]])
    const umpireCounts = new Map<number, number>()
    const conflicts: TeamConflict[] = [
      { teamAId: 1, teamBId: 4, level: "same_slot" },
      { teamAId: 2, teamBId: 5, level: "same_day" },
    ]
    const result = selectUmpireTeam(
      10,
      { teamAId: 1, teamBId: 2 },
      occupancy,
      umpireCounts,
      conflicts,
      divisionTeamIds
    )
    expect(result).toBe(6)
  })

  it("excludes teams of a different format from umpiring", () => {
    const occupancy: OccupancyMap = new Map()
    const umpireCounts = new Map<number, number>()
    // Teams 1-3 are leather, teams 4-6 are tape_ball
    const teamFormatMap = new Map<number, string>([
      [1, "leather"], [2, "leather"], [3, "leather"],
      [4, "tape_ball"], [5, "tape_ball"], [6, "tape_ball"],
    ])
    // Leather match: only leather teams (3) should be eligible
    const result = selectUmpireTeam(
      10,
      { teamAId: 1, teamBId: 2 },
      occupancy,
      umpireCounts,
      [],
      divisionTeamIds,
      "leather",
      teamFormatMap
    )
    expect(result).toBe(3)
  })

  it("excludes teams of a different format — tape_ball match gets tape_ball umpire", () => {
    const occupancy: OccupancyMap = new Map()
    const umpireCounts = new Map<number, number>()
    const teamFormatMap = new Map<number, string>([
      [1, "leather"], [2, "leather"], [3, "leather"],
      [4, "tape_ball"], [5, "tape_ball"], [6, "tape_ball"],
    ])
    // Tape ball match between 4 and 5: only tape_ball teams (6) eligible
    const result = selectUmpireTeam(
      10,
      { teamAId: 4, teamBId: 5 },
      occupancy,
      umpireCounts,
      [],
      divisionTeamIds,
      "tape_ball",
      teamFormatMap
    )
    expect(result).toBe(6)
  })

  it("still works without format filtering (backward compatible)", () => {
    const occupancy: OccupancyMap = new Map()
    const umpireCounts = new Map<number, number>()
    // No matchFormat or teamFormatMap → all non-playing teams eligible
    const result = selectUmpireTeam(
      10,
      { teamAId: 1, teamBId: 2 },
      occupancy,
      umpireCounts,
      [],
      divisionTeamIds
    )
    expect([3, 4, 5, 6]).toContain(result)
  })
})
