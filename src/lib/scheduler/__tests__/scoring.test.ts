import { describe, it, expect } from "vitest"
import { scoreSlot, getDayMatchCount } from "../scoring"
import type { ScoreContext } from "../scoring"

type SlotLike = { id: number; date: string; groundId: number; startTime: string }

function emptyContext(): ScoreContext {
  return {
    teamDayCounts: new Map(),
    umpireCounts: new Map(),
    occupancy: new Map(),
    allSlots: [],
    teamGroundCounts: new Map(),
    teamTimeCounts: new Map(),
    teamTotalMatchCounts: new Map(),
  }
}

describe("scoreSlot", () => {
  const slot: SlotLike = { id: 1, date: "2025-03-01", groundId: 100, startTime: "08:00" }
  const match = { teamAId: 10, teamBId: 20 }

  it("returns 0 for an empty schedule", () => {
    const score = scoreSlot(slot, match, emptyContext())
    expect(score).toBe(0)
  })

  it("penalizes team A day clumping by +10 per existing match on that day", () => {
    const ctx = emptyContext()
    ctx.teamDayCounts.set(10, new Map([["2025-03-01", 2]]))
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(20)
  })

  it("penalizes team B day clumping by +10 per existing match on that day", () => {
    const ctx = emptyContext()
    ctx.teamDayCounts.set(20, new Map([["2025-03-01", 3]]))
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(30)
  })

  it("penalizes both teams day clumping additively", () => {
    const ctx = emptyContext()
    ctx.teamDayCounts.set(10, new Map([["2025-03-01", 1]]))
    ctx.teamDayCounts.set(20, new Map([["2025-03-01", 2]]))
    // teamA: 1*10=10, teamB: 2*10=20 → 30
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(30)
  })

  it("adds day load from occupancy", () => {
    const ctx = emptyContext()
    ctx.occupancy = new Map([
      [1, [30, 40]],
      [2, [50, 60]],
      [3, [70, 80]],
    ])
    ctx.allSlots = [
      { id: 1, date: "2025-03-01", groundId: 100, startTime: "08:00" },
      { id: 2, date: "2025-03-01", groundId: 101, startTime: "12:00" },
      { id: 3, date: "2025-03-02", groundId: 100, startTime: "08:00" },
    ]
    // dayLoad = 2 matches on 2025-03-01
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(2)
  })

  it("combines clumping and day load penalties", () => {
    const ctx = emptyContext()
    ctx.teamDayCounts.set(10, new Map([["2025-03-01", 1]]))
    ctx.occupancy = new Map([[1, [30, 40]]])
    ctx.allSlots = [{ id: 1, date: "2025-03-01", groundId: 100, startTime: "08:00" }]
    // teamA: 1*10=10, teamB: 0, dayLoad: 1 → 11
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(11)
  })

  it("returns non-negative score", () => {
    const score = scoreSlot(slot, match, emptyContext())
    expect(score).toBeGreaterThanOrEqual(0)
  })

  it("ignores team day counts for different dates", () => {
    const ctx = emptyContext()
    ctx.teamDayCounts.set(10, new Map([["2025-03-02", 5]]))
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(0)
  })

  // --- NEW: Ground fairness ---
  it("penalizes team A ground clumping by +8 per existing match on that ground", () => {
    const ctx = emptyContext()
    ctx.teamGroundCounts.set(10, new Map([[100, 3]]))
    // teamA has 3 matches on ground 100 → +24
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(24)
  })

  it("penalizes both teams ground clumping additively", () => {
    const ctx = emptyContext()
    ctx.teamGroundCounts.set(10, new Map([[100, 1]]))
    ctx.teamGroundCounts.set(20, new Map([[100, 2]]))
    // teamA: 1*8=8, teamB: 2*8=16 → 24
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(24)
  })

  it("ignores ground counts for different grounds", () => {
    const ctx = emptyContext()
    ctx.teamGroundCounts.set(10, new Map([[999, 5]]))
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(0)
  })

  // --- NEW: Time-of-day fairness ---
  it("penalizes team A time slot clumping by +8 per existing match at that start time", () => {
    const ctx = emptyContext()
    ctx.teamTimeCounts.set(10, new Map([["08:00", 2]]))
    // teamA has 2 matches at 08:00 → +16
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(16)
  })

  it("penalizes both teams time slot clumping additively", () => {
    const ctx = emptyContext()
    ctx.teamTimeCounts.set(10, new Map([["08:00", 1]]))
    ctx.teamTimeCounts.set(20, new Map([["08:00", 3]]))
    // teamA: 1*8=8, teamB: 3*8=24 → 32
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(32)
  })

  it("ignores time counts for different start times", () => {
    const ctx = emptyContext()
    ctx.teamTimeCounts.set(10, new Map([["12:00", 5]]))
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(0)
  })

  // --- Combined ---
  it("combines all penalty dimensions", () => {
    const ctx = emptyContext()
    ctx.teamDayCounts.set(10, new Map([["2025-03-01", 1]]))   // +10
    ctx.teamGroundCounts.set(10, new Map([[100, 1]]))           // +8
    ctx.teamTimeCounts.set(10, new Map([["08:00", 1]]))         // +8
    // total = 10 + 8 + 8 = 26
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(26)
  })

  // --- Round-robin fairness: teams with more games get penalized ---
  it("penalizes teams that have more total matches than the minimum across all teams", () => {
    const ctx = emptyContext()
    // Team 10 has 3 matches, team 20 has 1 match, minimum across all is 1
    // Team 10 excess = 3-1 = 2, team 20 excess = 0
    // Penalty = 2 * 50 = 100
    ctx.teamTotalMatchCounts.set(10, 3)
    ctx.teamTotalMatchCounts.set(20, 1)
    ctx.teamTotalMatchCounts.set(30, 1) // another team at minimum
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(100)
  })

  it("applies zero round-robin penalty when all teams have equal match counts", () => {
    const ctx = emptyContext()
    ctx.teamTotalMatchCounts.set(10, 2)
    ctx.teamTotalMatchCounts.set(20, 2)
    ctx.teamTotalMatchCounts.set(30, 2)
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(0)
  })

  it("applies round-robin penalty to both teams additively", () => {
    const ctx = emptyContext()
    // min = 0 (team 30), team 10 excess = 2, team 20 excess = 1
    // penalty = (2 + 1) * 50 = 150
    ctx.teamTotalMatchCounts.set(10, 2)
    ctx.teamTotalMatchCounts.set(20, 1)
    ctx.teamTotalMatchCounts.set(30, 0)
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(150)
  })

  it("applies no round-robin penalty when teamTotalMatchCounts is empty", () => {
    const ctx = emptyContext()
    // empty map → no penalty (backward compatible)
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(0)
  })

  // --- Ratio-based round-robin fairness (cross-division / different group sizes) ---
  it("applies ratio-based penalty when teamExpectedMatchCounts is provided", () => {
    const ctx = emptyContext()
    // Leather team 10: 4 scheduled out of 10 expected = 40% progress
    // Tape ball team 20: 1 scheduled out of 5 expected = 20% progress
    // Team 30: 0 scheduled out of 5 expected = 0% progress (minimum ratio)
    ctx.teamTotalMatchCounts.set(10, 4)
    ctx.teamTotalMatchCounts.set(20, 1)
    ctx.teamTotalMatchCounts.set(30, 0)
    ctx.teamExpectedMatchCounts = new Map([[10, 10], [20, 5], [30, 5]])
    // Ratios: team10=0.4, team20=0.2, team30=0.0
    // minRatio = 0.0
    // team10 excess ratio = 0.4 - 0.0 = 0.4 → penalty = floor(0.4 * 100) * 50 = 40 * 50 = 2000
    // team20 excess ratio = 0.2 - 0.0 = 0.2 → penalty = floor(0.2 * 100) * 50 = 20 * 50 = 1000
    // total = 3000
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(3000)
  })

  it("applies zero ratio penalty when all teams have equal progress ratios", () => {
    const ctx = emptyContext()
    // Team 10: 5/10 = 50%, Team 20: 2/4 = 50%, Team 30: 3/6 = 50%
    ctx.teamTotalMatchCounts.set(10, 5)
    ctx.teamTotalMatchCounts.set(20, 2)
    ctx.teamTotalMatchCounts.set(30, 3)
    ctx.teamExpectedMatchCounts = new Map([[10, 10], [20, 4], [30, 6]])
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(0)
  })

  it("falls back to raw count penalty when teamExpectedMatchCounts is not provided", () => {
    const ctx = emptyContext()
    // No teamExpectedMatchCounts → uses raw counts like before
    ctx.teamTotalMatchCounts.set(10, 3)
    ctx.teamTotalMatchCounts.set(20, 1)
    ctx.teamTotalMatchCounts.set(30, 1)
    // min = 1, team10 excess = 2, team20 excess = 0 → 2 * 50 = 100
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(100)
  })

  it("handles ratio penalty with teams at different group sizes correctly", () => {
    const ctx = emptyContext()
    // Leather group: 6 teams → 15 matches per team pair, each team plays 5
    // Tape ball group: 4 teams → 6 matches per team pair, each team plays 3
    // Team 10 (leather): 2/5 = 40%
    // Team 20 (tape ball): 1/3 = 33.3%
    // Team 30 (tape ball): 1/3 = 33.3%
    ctx.teamTotalMatchCounts.set(10, 2)
    ctx.teamTotalMatchCounts.set(20, 1)
    ctx.teamTotalMatchCounts.set(30, 1)
    ctx.teamExpectedMatchCounts = new Map([[10, 5], [20, 3], [30, 3]])
    // Ratios: 10=0.4, 20=0.333, 30=0.333
    // minRatio = 0.333...
    // team10 excess = 0.4 - 0.333 = 0.0666 → floor(0.0666 * 100) = 6 → 6 * 50 = 300
    // team20 excess = 0.333 - 0.333 = 0 → 0
    // total = 300
    const score = scoreSlot(slot, match, ctx)
    expect(score).toBe(300)
  })
})

describe("getDayMatchCount", () => {
  it("returns 0 for empty occupancy", () => {
    expect(getDayMatchCount(new Map(), [], "2025-03-01")).toBe(0)
  })

  it("counts matches on the given date", () => {
    const occupancy = new Map<number, number[]>([
      [1, [10, 20]],
      [2, [30, 40]],
      [3, [50, 60]],
    ])
    const allSlots = [
      { id: 1, date: "2025-03-01" },
      { id: 2, date: "2025-03-01" },
      { id: 3, date: "2025-03-02" },
    ]
    expect(getDayMatchCount(occupancy, allSlots, "2025-03-01")).toBe(2)
  })

  it("returns 0 for a date with no matches", () => {
    const occupancy = new Map<number, number[]>([[1, [10, 20]]])
    const allSlots = [{ id: 1, date: "2025-03-01" }]
    expect(getDayMatchCount(occupancy, allSlots, "2025-03-02")).toBe(0)
  })

  it("does not count empty slots", () => {
    const occupancy = new Map<number, number[]>([
      [1, []],
      [2, [10, 20]],
    ])
    const allSlots = [
      { id: 1, date: "2025-03-01" },
      { id: 2, date: "2025-03-01" },
    ]
    expect(getDayMatchCount(occupancy, allSlots, "2025-03-01")).toBe(1)
  })
})
