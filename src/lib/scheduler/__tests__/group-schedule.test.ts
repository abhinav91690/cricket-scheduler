import { describe, it, expect } from "vitest"
import { generateGroupSchedule } from "../group-schedule"
import type { ScheduleInput, ExistingMatch, ScheduledMatch } from "../group-schedule"
import type { TeamConflict, SlotRef, MatchRef } from "../types"

describe("generateGroupSchedule", () => {
  // Helper to create slots
  function slot(id: number, date: string, groundFormat: string, groundId = 1, startTime = "08:00"): SlotRef {
    return { id, date, groundFormat, groundId, startTime }
  }

  // Helper to create matches
  function match(teamAId: number, teamBId: number, groupId = 1, format = "leather"): MatchRef {
    return { teamAId, teamBId, groupId, format }
  }

  it("schedules a single match to the only compatible slot", () => {
    const input: ScheduleInput = {
      matches: [match(1, 2)],
      slots: [slot(10, "2025-03-01", "leather")],
      conflicts: [],
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3, 4],
    }

    const result = generateGroupSchedule(input)

    expect(result.scheduled).toHaveLength(1)
    expect(result.unschedulable).toHaveLength(0)
    expect(result.scheduled[0].timeSlotId).toBe(10)
    expect(result.scheduled[0].teamAId).toBe(1)
    expect(result.scheduled[0].teamBId).toBe(2)
  })

  it("marks match as unschedulable when no compatible slot exists", () => {
    const input: ScheduleInput = {
      matches: [match(1, 2, 1, "leather")],
      slots: [slot(10, "2025-03-01", "tape_ball")],
      conflicts: [],
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3],
    }

    const result = generateGroupSchedule(input)

    expect(result.scheduled).toHaveLength(0)
    expect(result.unschedulable).toHaveLength(1)
    expect(result.unschedulable[0].teamAId).toBe(1)
    expect(result.unschedulable[0].teamBId).toBe(2)
    expect(result.unschedulable[0].reason).toBeTruthy()
  })

  it("does not double-book a team in the same slot", () => {
    const input: ScheduleInput = {
      matches: [match(1, 2), match(1, 3)],
      slots: [
        slot(10, "2025-03-01", "leather"),
        slot(11, "2025-03-08", "leather"),
      ],
      conflicts: [],
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3, 4],
    }

    const result = generateGroupSchedule(input)

    expect(result.scheduled).toHaveLength(2)
    // Team 1 should not be in the same slot twice
    const slotIds = result.scheduled.map((m: ScheduledMatch) => m.timeSlotId)
    expect(new Set(slotIds).size).toBe(2)
  })

  it("respects same_slot team conflicts", () => {
    const conflicts: TeamConflict[] = [
      { teamAId: 1, teamBId: 3, level: "same_slot" },
    ]
    const input: ScheduleInput = {
      matches: [match(1, 2), match(3, 4)],
      slots: [
        slot(10, "2025-03-01", "leather"),
        slot(11, "2025-03-08", "leather"),
      ],
      conflicts,
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3, 4, 5],
    }

    const result = generateGroupSchedule(input)

    expect(result.scheduled).toHaveLength(2)
    // Matches with conflicting teams should be in different slots
    const match1 = result.scheduled.find((m: ScheduledMatch) => m.teamAId === 1 || m.teamBId === 1)!
    const match3 = result.scheduled.find((m: ScheduledMatch) => m.teamAId === 3 || m.teamBId === 3)!
    expect(match1.timeSlotId).not.toBe(match3.timeSlotId)
  })

  it("respects same_day team conflicts", () => {
    const conflicts: TeamConflict[] = [
      { teamAId: 1, teamBId: 3, level: "same_day" },
    ]
    const input: ScheduleInput = {
      matches: [match(1, 2), match(3, 4)],
      slots: [
        slot(10, "2025-03-01", "leather"),
        slot(11, "2025-03-01", "leather"),
        slot(12, "2025-03-08", "leather"),
      ],
      conflicts,
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3, 4, 5],
    }

    const result = generateGroupSchedule(input)

    expect(result.scheduled).toHaveLength(2)
    // Matches with same_day conflicting teams should be on different days
    const match1 = result.scheduled.find((m: ScheduledMatch) => m.teamAId === 1 || m.teamBId === 1)!
    const match3 = result.scheduled.find((m: ScheduledMatch) => m.teamAId === 3 || m.teamBId === 3)!
    const slot1 = input.slots.find((s: SlotRef) => s.id === match1.timeSlotId)!
    const slot3 = input.slots.find((s: SlotRef) => s.id === match3.timeSlotId)!
    expect(slot1.date).not.toBe(slot3.date)
  })

  it("assigns umpire team from division teams", () => {
    const input: ScheduleInput = {
      matches: [match(1, 2)],
      slots: [slot(10, "2025-03-01", "leather")],
      conflicts: [],
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3, 4],
    }

    const result = generateGroupSchedule(input)

    expect(result.scheduled).toHaveLength(1)
    const umpire = result.scheduled[0].umpireTeam1Id
    // Umpire should not be a playing team
    expect(umpire).not.toBe(1)
    expect(umpire).not.toBe(2)
    // Umpire should be from division teams
    expect([3, 4]).toContain(umpire)
  })

  it("sets umpireTeam1Id to null when no valid umpire exists", () => {
    // Only 2 teams in division = no umpire candidates
    const input: ScheduleInput = {
      matches: [match(1, 2)],
      slots: [slot(10, "2025-03-01", "leather")],
      conflicts: [],
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2],
    }

    const result = generateGroupSchedule(input)

    expect(result.scheduled).toHaveLength(1)
    expect(result.scheduled[0].umpireTeam1Id).toBeNull()
  })

  it("builds occupancy from existing schedule", () => {
    const existing: ExistingMatch[] = [
      { timeSlotId: 10, teamAId: 3, teamBId: 4 },
    ]
    const input: ScheduleInput = {
      // Team 3 is already in slot 10, so match(1,3) can't go there
      matches: [match(1, 3)],
      slots: [
        slot(10, "2025-03-01", "leather"),
        slot(11, "2025-03-08", "leather"),
      ],
      conflicts: [],
      blackouts: [],
      existingSchedule: existing,
      divisionTeamIds: [1, 2, 3, 4, 5],
    }

    const result = generateGroupSchedule(input)

    expect(result.scheduled).toHaveLength(1)
    // Team 3 is in slot 10 from existing schedule, so new match should go to slot 11
    expect(result.scheduled[0].timeSlotId).toBe(11)
  })

  it("partition property: scheduled + unschedulable = input matches", () => {
    const input: ScheduleInput = {
      matches: [
        match(1, 2, 1, "leather"),
        match(3, 4, 1, "leather"),
        match(5, 6, 1, "tape_ball"), // no tape_ball slot
      ],
      slots: [
        slot(10, "2025-03-01", "leather"),
        slot(11, "2025-03-08", "leather"),
      ],
      conflicts: [],
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3, 4, 5, 6],
    }

    const result = generateGroupSchedule(input)

    expect(result.scheduled.length + result.unschedulable.length).toBe(3)
  })

  it("updates occupancy incrementally as matches are scheduled", () => {
    // Team 1 appears in both matches — can't share a slot
    const input: ScheduleInput = {
      matches: [match(1, 2), match(1, 3)],
      slots: [
        slot(10, "2025-03-01", "leather"),
        slot(11, "2025-03-08", "leather"),
      ],
      conflicts: [],
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3, 4, 5],
    }

    const result = generateGroupSchedule(input)

    expect(result.scheduled).toHaveLength(2)
    expect(result.unschedulable).toHaveLength(0)
    // Team 1 is in both matches, so they must be in different slots
    const slotIds = result.scheduled.map((m: ScheduledMatch) => m.timeSlotId)
    expect(new Set(slotIds).size).toBe(2)
  })

  it("prefers slots with lower score (less clumping)", () => {
    // Team 1 already has a match on day 1 via existing schedule
    const existing: ExistingMatch[] = [
      { timeSlotId: 10, teamAId: 1, teamBId: 5 },
    ]
    const input: ScheduleInput = {
      matches: [match(1, 2)],
      slots: [
        slot(10, "2025-03-01", "leather"), // existing match here
        slot(11, "2025-03-01", "leather"), // same day as existing — higher score
        slot(12, "2025-03-08", "leather"), // different weekend — lower score
      ],
      conflicts: [],
      blackouts: [],
      existingSchedule: existing,
      divisionTeamIds: [1, 2, 3, 4, 5],
    }

    const result = generateGroupSchedule(input)

    expect(result.scheduled).toHaveLength(1)
    // Should prefer day 2 (less clumping for team 1)
    expect(result.scheduled[0].timeSlotId).toBe(12)
  })

  it("unschedulable matches have a non-empty reason", () => {
    const input: ScheduleInput = {
      matches: [match(1, 2, 1, "leather")],
      slots: [slot(10, "2025-03-01", "tape_ball")],
      conflicts: [],
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3],
    }

    const result = generateGroupSchedule(input)

    expect(result.unschedulable).toHaveLength(1)
    expect(result.unschedulable[0].reason.length).toBeGreaterThan(0)
  })

  it("never assigns two matches to the same slot (cross-group)", () => {
    // Two groups with non-overlapping teams sharing the same slots
    const input: ScheduleInput = {
      matches: [
        match(1, 2, 1, "leather"),  // group 1
        match(3, 4, 1, "leather"),  // group 1
        match(10, 11, 2, "leather"), // group 2
        match(12, 13, 2, "leather"), // group 2
      ],
      slots: [
        slot(100, "2025-03-01", "leather"),
        slot(101, "2025-03-01", "leather"),
        slot(102, "2025-03-02", "leather"),
        slot(103, "2025-03-02", "leather"),
      ],
      conflicts: [],
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3, 4, 5, 10, 11, 12, 13, 14],
    }

    const result = generateGroupSchedule(input)

    expect(result.scheduled).toHaveLength(4)
    // Every scheduled match must have a unique slotId
    const slotIds = result.scheduled.map((m: ScheduledMatch) => m.timeSlotId)
    expect(new Set(slotIds).size).toBe(4)
  })

  it("distributes matches evenly across grounds", () => {
    // 6 matches, 2 grounds with 3 slots each
    const input: ScheduleInput = {
      matches: [
        match(1, 2), match(3, 4), match(5, 6),
        match(7, 8), match(9, 10), match(11, 12),
      ],
      slots: [
        slot(100, "2025-03-01", "leather", 1, "08:00"),
        slot(101, "2025-03-01", "leather", 2, "08:00"),
        slot(102, "2025-03-08", "leather", 1, "08:00"),
        slot(103, "2025-03-08", "leather", 2, "08:00"),
        slot(104, "2025-03-15", "leather", 1, "08:00"),
        slot(105, "2025-03-15", "leather", 2, "08:00"),
      ],
      conflicts: [],
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    }

    const result = generateGroupSchedule(input)
    expect(result.scheduled).toHaveLength(6)

    // Count matches per ground
    const groundCounts = new Map<number, number>()
    for (const m of result.scheduled) {
      const s = input.slots.find((sl) => sl.id === m.timeSlotId)!
      groundCounts.set(s.groundId, (groundCounts.get(s.groundId) ?? 0) + 1)
    }
    // Each ground should have 3 matches (6 matches / 2 grounds)
    expect(groundCounts.get(1)).toBe(3)
    expect(groundCounts.get(2)).toBe(3)
  })

  it("distributes matches evenly across time slots", () => {
    // 6 matches, 2 time slots (morning/afternoon) across 3 days
    const input: ScheduleInput = {
      matches: [
        match(1, 2), match(3, 4), match(5, 6),
        match(7, 8), match(9, 10), match(11, 12),
      ],
      slots: [
        slot(100, "2025-03-01", "leather", 1, "08:00"),
        slot(101, "2025-03-01", "leather", 1, "12:00"),
        slot(102, "2025-03-08", "leather", 1, "08:00"),
        slot(103, "2025-03-08", "leather", 1, "12:00"),
        slot(104, "2025-03-15", "leather", 1, "08:00"),
        slot(105, "2025-03-15", "leather", 1, "12:00"),
      ],
      conflicts: [],
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    }

    const result = generateGroupSchedule(input)
    expect(result.scheduled).toHaveLength(6)

    // Count matches per start time
    const timeCounts = new Map<string, number>()
    for (const m of result.scheduled) {
      const s = input.slots.find((sl) => sl.id === m.timeSlotId)!
      timeCounts.set(s.startTime, (timeCounts.get(s.startTime) ?? 0) + 1)
    }
    // Each time slot should have 3 matches (6 matches / 2 times)
    expect(timeCounts.get("08:00")).toBe(3)
    expect(timeCounts.get("12:00")).toBe(3)
  })

  it("spreads matches evenly across dates", () => {
    // 6 matches across 3 dates with 2 slots each
    const input: ScheduleInput = {
      matches: [
        match(1, 2), match(3, 4), match(5, 6),
        match(7, 8), match(9, 10), match(11, 12),
      ],
      slots: [
        slot(100, "2025-03-01", "leather", 1, "08:00"),
        slot(101, "2025-03-01", "leather", 2, "08:00"),
        slot(102, "2025-03-08", "leather", 1, "08:00"),
        slot(103, "2025-03-08", "leather", 2, "08:00"),
        slot(104, "2025-03-15", "leather", 1, "08:00"),
        slot(105, "2025-03-15", "leather", 2, "08:00"),
      ],
      conflicts: [],
      blackouts: [],
      existingSchedule: [],
      divisionTeamIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    }

    const result = generateGroupSchedule(input)
    expect(result.scheduled).toHaveLength(6)

    // Count matches per date
    const dateCounts = new Map<string, number>()
    for (const m of result.scheduled) {
      const s = input.slots.find((sl) => sl.id === m.timeSlotId)!
      dateCounts.set(s.date, (dateCounts.get(s.date) ?? 0) + 1)
    }
    // Each date should have 2 matches (6 matches / 3 dates)
    expect(dateCounts.get("2025-03-01")).toBe(2)
    expect(dateCounts.get("2025-03-08")).toBe(2)
    expect(dateCounts.get("2025-03-15")).toBe(2)
  })
})
