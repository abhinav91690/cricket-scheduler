import { describe, it, expect } from "vitest"
import { moveMatch, toggleLock } from "../match-ops"
import type { MatchRecord, MoveResult } from "../match-ops"
import type { TeamConflict, SlotRef, OccupancyMap } from "../types"

describe("moveMatch", () => {
  const baseMatch: MatchRecord = {
    id: 1,
    teamAId: 10,
    teamBId: 20,
    timeSlotId: 100,
    isLocked: false,
    status: "scheduled",
    conflictOverride: null,
    format: "leather",
    groupId: 1,
  }

  const newSlot: SlotRef = { id: 200, date: "2025-03-01", groundFormat: "leather", groundId: 1, startTime: "08:00" }

  const emptyOccupancy: OccupancyMap = new Map()
  const noConflicts: TeamConflict[] = []

  it("rejects move when match is locked", () => {
    const locked = { ...baseMatch, isLocked: true }
    const result = moveMatch(locked, newSlot, emptyOccupancy, noConflicts)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Match is locked")
  })

  it("rejects move when match is already played", () => {
    const played = { ...baseMatch, status: "played" }
    const result = moveMatch(played, newSlot, emptyOccupancy, noConflicts)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Match is already played")
  })

  it("rejects move when slot format is incompatible", () => {
    const tapeBallSlot: SlotRef = { id: 200, date: "2025-03-01", groundFormat: "tape_ball", groundId: 2, startTime: "08:00" }
    const result = moveMatch(baseMatch, tapeBallSlot, emptyOccupancy, noConflicts)
    expect(result.success).toBe(false)
    expect(result.error).toContain("format")
  })

  it("succeeds when no conflicts exist", () => {
    const result = moveMatch(baseMatch, newSlot, emptyOccupancy, noConflicts)
    expect(result.success).toBe(true)
    expect(result.conflict).toBeUndefined()
    expect(result.error).toBeUndefined()
  })

  it("returns conflict when team is double-booked in new slot", () => {
    const occupancy: OccupancyMap = new Map([[200, [10, 30]]]) // team 10 already in slot 200
    const result = moveMatch(baseMatch, newSlot, occupancy, noConflicts)
    expect(result.success).toBe(false)
    expect(result.conflict).toBeDefined()
  })

  it("returns conflict when team has same_slot conflict in new slot", () => {
    const occupancy: OccupancyMap = new Map([[200, [30, 40]]]) // other teams in slot
    const conflicts: TeamConflict[] = [{ teamAId: 10, teamBId: 30, level: "same_slot" }]
    const result = moveMatch(baseMatch, newSlot, occupancy, conflicts)
    expect(result.success).toBe(false)
    expect(result.conflict).toBeDefined()
  })

  it("succeeds with overrideConflict when conflict exists", () => {
    const occupancy: OccupancyMap = new Map([[200, [30, 40]]])
    const conflicts: TeamConflict[] = [{ teamAId: 10, teamBId: 30, level: "same_slot" }]
    const result = moveMatch(baseMatch, newSlot, occupancy, conflicts, true)
    expect(result.success).toBe(true)
  })

  it("succeeds without override when no conflict exists", () => {
    const occupancy: OccupancyMap = new Map([[200, [30, 40]]])
    const result = moveMatch(baseMatch, newSlot, occupancy, noConflicts)
    expect(result.success).toBe(true)
  })
})

describe("toggleLock", () => {
  it("rejects toggle when match is played", () => {
    const result = toggleLock({ isLocked: false, status: "played" })
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it("locks an unlocked match", () => {
    const result = toggleLock({ isLocked: false, status: "scheduled" })
    expect(result.success).toBe(true)
    expect(result.newLockState).toBe(true)
  })

  it("unlocks a locked match", () => {
    const result = toggleLock({ isLocked: true, status: "scheduled" })
    expect(result.success).toBe(true)
    expect(result.newLockState).toBe(false)
  })

  it("round-trips lock toggle", () => {
    const first = toggleLock({ isLocked: false, status: "scheduled" })
    expect(first.newLockState).toBe(true)
    const second = toggleLock({ isLocked: first.newLockState, status: "scheduled" })
    expect(second.newLockState).toBe(false)
  })
})
