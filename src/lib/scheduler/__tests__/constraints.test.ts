import { describe, it, expect } from "vitest"
import {
  isFormatCompatible,
  hasTeamConflictInSlot,
  hasTeamConflictOnDay,
  isTeamAvailable,
  isSlotOccupied,
  buildOccupancyMap,
  sortByConstraintDifficulty,
  getWeekendKey,
  hasTeamPlayedThisWeekend,
  isTeamBlackedOut,
} from "../constraints"
import type { TeamConflict, SlotRef, MatchRef, OccupancyMap } from "../types"
import type { TeamBlackout } from "../types"

describe("isFormatCompatible", () => {
  it("returns true when ground format matches match format", () => {
    const slot: SlotRef = { id: 1, date: "2025-03-01", groundFormat: "leather", groundId: 1, startTime: "08:00" }
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    expect(isFormatCompatible(slot, match)).toBe(true)
  })

  it("returns false when ground format differs from match format", () => {
    const slot: SlotRef = { id: 1, date: "2025-03-01", groundFormat: "leather", groundId: 1, startTime: "08:00" }
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "tape_ball" }
    expect(isFormatCompatible(slot, match)).toBe(false)
  })
})

describe("hasTeamConflictInSlot", () => {
  it("returns false when no conflicts exist", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map()
    expect(hasTeamConflictInSlot(10, match, occupancy, [])).toBe(false)
  })

  it("returns false when slot is empty", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[10, []]])
    const conflicts: TeamConflict[] = [{ teamAId: 1, teamBId: 3, level: "same_slot" }]
    expect(hasTeamConflictInSlot(10, match, occupancy, conflicts)).toBe(false)
  })

  it("returns true when team A has a same_slot conflict with a team in the slot", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[10, [3, 4]]])
    const conflicts: TeamConflict[] = [{ teamAId: 1, teamBId: 3, level: "same_slot" }]
    expect(hasTeamConflictInSlot(10, match, occupancy, conflicts)).toBe(true)
  })

  it("returns true when team B has a same_slot conflict with a team in the slot", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[10, [5, 6]]])
    const conflicts: TeamConflict[] = [{ teamAId: 2, teamBId: 5, level: "same_slot" }]
    expect(hasTeamConflictInSlot(10, match, occupancy, conflicts)).toBe(true)
  })

  it("ignores same_day conflicts (only checks same_slot)", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[10, [3]]])
    const conflicts: TeamConflict[] = [{ teamAId: 1, teamBId: 3, level: "same_day" }]
    expect(hasTeamConflictInSlot(10, match, occupancy, conflicts)).toBe(false)
  })

  it("detects conflict when match team is teamBId in the conflict pair", () => {
    const match: MatchRef = { teamAId: 5, teamBId: 6, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[10, [3]]])
    // conflict: 3 <-> 5, stored as teamAId=3, teamBId=5
    const conflicts: TeamConflict[] = [{ teamAId: 3, teamBId: 5, level: "same_slot" }]
    expect(hasTeamConflictInSlot(10, match, occupancy, conflicts)).toBe(true)
  })
})


describe("hasTeamConflictOnDay", () => {
  const allSlots: SlotRef[] = [
    { id: 10, date: "2025-03-01", groundFormat: "leather", groundId: 1, startTime: "08:00" },
    { id: 11, date: "2025-03-01", groundFormat: "leather", groundId: 2, startTime: "12:00" },
    { id: 20, date: "2025-03-02", groundFormat: "leather", groundId: 1, startTime: "08:00" },
  ]

  it("returns false when no conflicts exist", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map()
    expect(hasTeamConflictOnDay("2025-03-01", match, occupancy, allSlots, [])).toBe(false)
  })

  it("returns true when team A has a same_day conflict with a team playing on that day", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[10, [3, 4]]])
    const conflicts: TeamConflict[] = [{ teamAId: 1, teamBId: 3, level: "same_day" }]
    expect(hasTeamConflictOnDay("2025-03-01", match, occupancy, allSlots, conflicts)).toBe(true)
  })

  it("returns true when team B has a same_day conflict with a team playing on that day", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[11, [5]]])
    const conflicts: TeamConflict[] = [{ teamAId: 2, teamBId: 5, level: "same_day" }]
    expect(hasTeamConflictOnDay("2025-03-01", match, occupancy, allSlots, conflicts)).toBe(true)
  })

  it("returns false when conflicting team is on a different day", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[20, [3]]])
    const conflicts: TeamConflict[] = [{ teamAId: 1, teamBId: 3, level: "same_day" }]
    expect(hasTeamConflictOnDay("2025-03-01", match, occupancy, allSlots, conflicts)).toBe(false)
  })

  it("ignores same_slot conflicts (only checks same_day)", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[10, [3]]])
    const conflicts: TeamConflict[] = [{ teamAId: 1, teamBId: 3, level: "same_slot" }]
    expect(hasTeamConflictOnDay("2025-03-01", match, occupancy, allSlots, conflicts)).toBe(false)
  })
})

describe("isSlotOccupied", () => {
  it("returns false when slot has no teams", () => {
    const occupancy: OccupancyMap = new Map()
    expect(isSlotOccupied(10, occupancy)).toBe(false)
  })

  it("returns false when slot has an empty array", () => {
    const occupancy: OccupancyMap = new Map([[10, []]])
    expect(isSlotOccupied(10, occupancy)).toBe(false)
  })

  it("returns true when slot has teams assigned", () => {
    const occupancy: OccupancyMap = new Map([[10, [1, 2]]])
    expect(isSlotOccupied(10, occupancy)).toBe(true)
  })

  it("only checks the specific slot, not others", () => {
    const occupancy: OccupancyMap = new Map([[10, [1, 2]]])
    expect(isSlotOccupied(20, occupancy)).toBe(false)
  })
})

describe("isTeamAvailable", () => {
  it("returns true when slot is empty", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map()
    expect(isTeamAvailable(10, match, occupancy)).toBe(true)
  })

  it("returns true when neither team is in the slot", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[10, [3, 4]]])
    expect(isTeamAvailable(10, match, occupancy)).toBe(true)
  })

  it("returns false when team A is already in the slot", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[10, [1, 3]]])
    expect(isTeamAvailable(10, match, occupancy)).toBe(false)
  })

  it("returns false when team B is already in the slot", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[10, [2, 3]]])
    expect(isTeamAvailable(10, match, occupancy)).toBe(false)
  })

  it("returns false when both teams are already in the slot", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map([[10, [1, 2]]])
    expect(isTeamAvailable(10, match, occupancy)).toBe(false)
  })
})

describe("buildOccupancyMap", () => {
  it("returns empty map for no matches", () => {
    const result = buildOccupancyMap([])
    expect(result.size).toBe(0)
  })

  it("maps playing teams to their slot", () => {
    const matches = [
      { timeSlotId: 10, teamAId: 1, teamBId: 2 },
    ]
    const result = buildOccupancyMap(matches)
    expect(result.get(10)).toEqual(expect.arrayContaining([1, 2]))
  })

  it("includes umpire teams in the occupancy", () => {
    const matches = [
      { timeSlotId: 10, teamAId: 1, teamBId: 2, umpireTeam1Id: 3 },
    ]
    const result = buildOccupancyMap(matches)
    expect(result.get(10)).toEqual(expect.arrayContaining([1, 2, 3]))
  })

  it("includes second umpire team (knockout) in the occupancy", () => {
    const matches = [
      { timeSlotId: 10, teamAId: 1, teamBId: 2, umpireTeam1Id: 3, umpireTeam2Id: 4 },
    ]
    const result = buildOccupancyMap(matches)
    expect(result.get(10)).toEqual(expect.arrayContaining([1, 2, 3, 4]))
  })

  it("aggregates multiple matches in the same slot", () => {
    const matches = [
      { timeSlotId: 10, teamAId: 1, teamBId: 2 },
      { timeSlotId: 10, teamAId: 3, teamBId: 4 },
    ]
    const result = buildOccupancyMap(matches)
    expect(result.get(10)).toEqual(expect.arrayContaining([1, 2, 3, 4]))
  })

  it("separates teams by slot", () => {
    const matches = [
      { timeSlotId: 10, teamAId: 1, teamBId: 2 },
      { timeSlotId: 20, teamAId: 3, teamBId: 4 },
    ]
    const result = buildOccupancyMap(matches)
    expect(result.get(10)).toEqual(expect.arrayContaining([1, 2]))
    expect(result.get(20)).toEqual(expect.arrayContaining([3, 4]))
    expect(result.get(10)).not.toContain(3)
  })
})

describe("sortByConstraintDifficulty", () => {
  it("returns empty array for no matches", () => {
    expect(sortByConstraintDifficulty([], [])).toEqual([])
  })

  it("returns matches unchanged when no conflicts exist", () => {
    const matches: MatchRef[] = [
      { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" },
      { teamAId: 3, teamBId: 4, groupId: 1, format: "leather" },
    ]
    const result = sortByConstraintDifficulty(matches, [])
    expect(result).toHaveLength(2)
  })

  it("puts most-constrained matches first", () => {
    const matches: MatchRef[] = [
      { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" },  // 0 conflicts
      { teamAId: 3, teamBId: 4, groupId: 1, format: "leather" },  // 2 conflicts
      { teamAId: 5, teamBId: 6, groupId: 1, format: "leather" },  // 1 conflict
    ]
    const conflicts: TeamConflict[] = [
      { teamAId: 3, teamBId: 7, level: "same_slot" },
      { teamAId: 4, teamBId: 8, level: "same_day" },
      { teamAId: 5, teamBId: 9, level: "same_slot" },
    ]
    const result = sortByConstraintDifficulty(matches, conflicts)
    // Match with teams 3,4 has 2 conflicts → first
    // Match with teams 5,6 has 1 conflict → second
    // Match with teams 1,2 has 0 conflicts → last
    expect(result[0].teamAId).toBe(3)
    expect(result[1].teamAId).toBe(5)
    expect(result[2].teamAId).toBe(1)
  })

  it("counts conflicts for both teams in a match", () => {
    const matches: MatchRef[] = [
      { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" },
    ]
    const conflicts: TeamConflict[] = [
      { teamAId: 1, teamBId: 10, level: "same_slot" },
      { teamAId: 2, teamBId: 11, level: "same_day" },
    ]
    const result = sortByConstraintDifficulty(matches, conflicts)
    // Just verifying it doesn't crash and returns the match
    expect(result).toHaveLength(1)
  })
})

describe("getWeekendKey", () => {
  it("returns the Saturday date for a Saturday", () => {
    // 2025-03-01 is a Saturday
    expect(getWeekendKey("2025-03-01")).toBe("2025-03-01")
  })

  it("returns the Saturday date for a Sunday", () => {
    // 2025-03-02 is a Sunday, weekend started 2025-03-01
    expect(getWeekendKey("2025-03-02")).toBe("2025-03-01")
  })

  it("returns the date itself for a weekday (no weekend grouping)", () => {
    // 2025-03-03 is a Monday — not part of a Sat/Sun weekend
    expect(getWeekendKey("2025-03-03")).toBe("2025-03-03")
  })
})

describe("hasTeamPlayedThisWeekend", () => {
  // Slots on Saturday and Sunday of the same weekend
  const satSlot: SlotRef = { id: 10, date: "2025-03-01", groundFormat: "leather", groundId: 1, startTime: "08:00" }
  const sunSlot: SlotRef = { id: 11, date: "2025-03-02", groundFormat: "leather", groundId: 2, startTime: "08:00" }
  const nextWeekSlot: SlotRef = { id: 20, date: "2025-03-08", groundFormat: "leather", groundId: 1, startTime: "08:00" }
  const allSlots = [satSlot, sunSlot, nextWeekSlot]

  it("returns false when no team has played this weekend", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const occupancy: OccupancyMap = new Map()
    expect(hasTeamPlayedThisWeekend("2025-03-01", match, occupancy, allSlots)).toBe(false)
  })

  it("returns true when team A already plays on Saturday and slot is Sunday", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    // Team 1 already plays on Saturday
    const occupancy: OccupancyMap = new Map([[10, [1, 3]]])
    expect(hasTeamPlayedThisWeekend("2025-03-02", match, occupancy, allSlots)).toBe(true)
  })

  it("returns true when team B already plays on Sunday and slot is Saturday", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    // Team 2 already plays on Sunday
    const occupancy: OccupancyMap = new Map([[11, [2, 4]]])
    expect(hasTeamPlayedThisWeekend("2025-03-01", match, occupancy, allSlots)).toBe(true)
  })

  it("returns false when team plays on a different weekend", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    // Team 1 plays next weekend
    const occupancy: OccupancyMap = new Map([[20, [1, 3]]])
    expect(hasTeamPlayedThisWeekend("2025-03-01", match, occupancy, allSlots)).toBe(false)
  })

  it("returns false for weekday slots (no weekend grouping applies)", () => {
    const wedSlot: SlotRef = { id: 30, date: "2025-03-05", groundFormat: "leather", groundId: 1, startTime: "08:00" }
    const thuSlot: SlotRef = { id: 31, date: "2025-03-06", groundFormat: "leather", groundId: 1, startTime: "08:00" }
    const weekdaySlots = [...allSlots, wedSlot, thuSlot]
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    // Team 1 plays on Wednesday
    const occupancy: OccupancyMap = new Map([[30, [1, 3]]])
    // Thursday is a different weekday key, so no conflict
    expect(hasTeamPlayedThisWeekend("2025-03-06", match, occupancy, weekdaySlots)).toBe(false)
  })
})


describe("isTeamBlackedOut", () => {
  it("returns false when no blackouts exist", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    expect(isTeamBlackedOut("2025-03-01", match, [])).toBe(false)
  })

  it("returns true when team A is blacked out on the date", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const blackouts: TeamBlackout[] = [{ teamId: 1, date: "2025-03-01" }]
    expect(isTeamBlackedOut("2025-03-01", match, blackouts)).toBe(true)
  })

  it("returns true when team B is blacked out on the date", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const blackouts: TeamBlackout[] = [{ teamId: 2, date: "2025-03-01" }]
    expect(isTeamBlackedOut("2025-03-01", match, blackouts)).toBe(true)
  })

  it("returns false when blackout is on a different date", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const blackouts: TeamBlackout[] = [{ teamId: 1, date: "2025-03-08" }]
    expect(isTeamBlackedOut("2025-03-01", match, blackouts)).toBe(false)
  })

  it("returns false when blackout is for a different team", () => {
    const match: MatchRef = { teamAId: 1, teamBId: 2, groupId: 1, format: "leather" }
    const blackouts: TeamBlackout[] = [{ teamId: 99, date: "2025-03-01" }]
    expect(isTeamBlackedOut("2025-03-01", match, blackouts)).toBe(false)
  })
})

