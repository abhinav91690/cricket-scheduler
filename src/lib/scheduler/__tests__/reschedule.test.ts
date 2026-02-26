import { describe, it, expect } from "vitest"
import { reschedule } from "../reschedule"
import type { RescheduleInput } from "../reschedule"
import type { SlotRef, TeamConflict } from "../types"

describe("reschedule", () => {
  function slot(id: number, date: string, groundFormat: string, groundId = 1, startTime = "08:00"): SlotRef {
    return { id, date, groundFormat, groundId, startTime }
  }

  function makeMatch(overrides: Partial<RescheduleInput["allMatches"][0]> & { teamAId: number; teamBId: number }) {
    return {
      groupId: 1,
      format: "leather",
      isLocked: false,
      status: "scheduled",
      timeSlotId: undefined,
      umpireTeam1Id: undefined,
      umpireTeam2Id: undefined,
      ...overrides,
    }
  }

  it("returns empty result with message when no matches are eligible", () => {
    const input: RescheduleInput = {
      allMatches: [
        makeMatch({ teamAId: 1, teamBId: 2, isLocked: true, status: "scheduled", timeSlotId: 10 }),
        makeMatch({ teamAId: 3, teamBId: 4, status: "played", timeSlotId: 11 }),
      ],
      slots: [slot(10, "2025-03-01", "leather"), slot(11, "2025-03-01", "leather")],
      conflicts: [],
      blackouts: [],
      divisionTeamIds: [1, 2, 3, 4, 5],
    }

    const result = reschedule(input)

    expect(result.scheduled).toHaveLength(0)
    expect(result.unschedulable).toHaveLength(0)
    expect(result.message).toBe("No matches eligible for re-scheduling")
  })

  it("preserves locked matches and reschedules unlocked ones", () => {
    const input: RescheduleInput = {
      allMatches: [
        makeMatch({ teamAId: 1, teamBId: 2, isLocked: true, status: "scheduled", timeSlotId: 10 }),
        makeMatch({ teamAId: 3, teamBId: 4, isLocked: false, status: "scheduled", timeSlotId: 11 }),
      ],
      slots: [
        slot(10, "2025-03-01", "leather"),
        slot(11, "2025-03-01", "leather"),
        slot(12, "2025-03-02", "leather"),
      ],
      conflicts: [],
      blackouts: [],
      divisionTeamIds: [1, 2, 3, 4, 5],
    }

    const result = reschedule(input)

    expect(result.scheduled).toHaveLength(1)
    expect(result.scheduled[0].teamAId).toBe(3)
    expect(result.scheduled[0].teamBId).toBe(4)
    expect(result.scheduled[0].timeSlotId).toBeDefined()
  })

  it("preserves played matches and reschedules unplayed ones", () => {
    const input: RescheduleInput = {
      allMatches: [
        makeMatch({ teamAId: 1, teamBId: 2, status: "played", timeSlotId: 10 }),
        makeMatch({ teamAId: 3, teamBId: 4, status: "scheduled", isLocked: false }),
      ],
      slots: [
        slot(10, "2025-03-01", "leather"),
        slot(11, "2025-03-02", "leather"),
      ],
      conflicts: [],
      blackouts: [],
      divisionTeamIds: [1, 2, 3, 4, 5],
    }

    const result = reschedule(input)

    expect(result.scheduled).toHaveLength(1)
    expect(result.scheduled[0].teamAId).toBe(3)
    expect(result.scheduled[0].teamBId).toBe(4)
  })

  it("passes locked/played matches as existingSchedule to generateGroupSchedule", () => {
    // Locked match occupies slot 10, so the rescheduled match should avoid it
    const input: RescheduleInput = {
      allMatches: [
        makeMatch({ teamAId: 1, teamBId: 2, isLocked: true, status: "scheduled", timeSlotId: 10 }),
        makeMatch({ teamAId: 1, teamBId: 3, isLocked: false, status: "scheduled", timeSlotId: 10 }),
      ],
      slots: [
        slot(10, "2025-03-01", "leather"),
        slot(11, "2025-03-08", "leather"),
      ],
      conflicts: [],
      blackouts: [],
      divisionTeamIds: [1, 2, 3, 4, 5],
    }

    const result = reschedule(input)

    expect(result.scheduled).toHaveLength(1)
    // Team 1 is in slot 10 (locked), so match(1,3) must go to slot 11
    expect(result.scheduled[0].timeSlotId).toBe(11)
  })

  it("passes conflicts through to generateGroupSchedule", () => {
    const conflicts: TeamConflict[] = [
      { teamAId: 1, teamBId: 3, level: "same_slot" },
    ]
    const input: RescheduleInput = {
      allMatches: [
        makeMatch({ teamAId: 1, teamBId: 2, isLocked: false, status: "scheduled" }),
        makeMatch({ teamAId: 3, teamBId: 4, isLocked: false, status: "scheduled" }),
      ],
      slots: [
        slot(10, "2025-03-01", "leather"),
        slot(11, "2025-03-08", "leather"),
      ],
      conflicts,
      blackouts: [],
      divisionTeamIds: [1, 2, 3, 4, 5],
    }

    const result = reschedule(input)

    expect(result.scheduled).toHaveLength(2)
    const m1 = result.scheduled.find((m) => m.teamAId === 1)!
    const m3 = result.scheduled.find((m) => m.teamAId === 3)!
    expect(m1.timeSlotId).not.toBe(m3.timeSlotId)
  })

  it("clears slot assignments for eligible matches before rescheduling", () => {
    // Both unlocked matches are on slot 10 (double-booked in input).
    // After clearing and rescheduling, they should end up on different slots.
    const input: RescheduleInput = {
      allMatches: [
        makeMatch({ teamAId: 1, teamBId: 2, isLocked: false, status: "scheduled", timeSlotId: 10 }),
        makeMatch({ teamAId: 3, teamBId: 4, isLocked: false, status: "scheduled", timeSlotId: 10 }),
      ],
      slots: [
        slot(10, "2025-03-01", "leather"),
        slot(11, "2025-03-08", "leather"),
      ],
      conflicts: [],
      blackouts: [],
      divisionTeamIds: [1, 2, 3, 4, 5],
    }

    const result = reschedule(input)

    expect(result.scheduled).toHaveLength(2)
    const slotIds = result.scheduled.map((m) => m.timeSlotId)
    expect(new Set(slotIds).size).toBe(2)
  })
})
