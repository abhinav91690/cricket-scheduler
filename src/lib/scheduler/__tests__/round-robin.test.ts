import { describe, it, expect } from "vitest"
import {
  generateRoundRobinPairings,
  type TeamRef,
  type Pairing,
} from "../round-robin"

function makeTeams(n: number): TeamRef[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Team ${i + 1}`,
  }))
}

describe("generateRoundRobinPairings", () => {
  it("returns 1 pairing for 2 teams", () => {
    const teams = makeTeams(2)
    const pairings = generateRoundRobinPairings(teams)

    expect(pairings).toHaveLength(1)
    expect(pairings[0]).toEqual([teams[0], teams[1]])
  })

  it("returns 3 pairings for 3 teams", () => {
    const teams = makeTeams(3)
    const pairings = generateRoundRobinPairings(teams)

    expect(pairings).toHaveLength(3)
    // All pairs: (1,2), (1,3), (2,3)
    expect(pairings).toContainEqual([teams[0], teams[1]])
    expect(pairings).toContainEqual([teams[0], teams[2]])
    expect(pairings).toContainEqual([teams[1], teams[2]])
  })

  it("returns exactly N*(N-1)/2 pairings", () => {
    const teams = makeTeams(5)
    const pairings = generateRoundRobinPairings(teams)

    expect(pairings).toHaveLength((5 * 4) / 2) // 10
  })

  it("throws error for fewer than 2 teams", () => {
    expect(() => generateRoundRobinPairings([])).toThrow()
    expect(() => generateRoundRobinPairings(makeTeams(1))).toThrow()
  })

  it("contains no self-pairings", () => {
    const teams = makeTeams(4)
    const pairings = generateRoundRobinPairings(teams)

    for (const [a, b] of pairings) {
      expect(a.id).not.toBe(b.id)
    }
  })

  it("contains no duplicate pairings", () => {
    const teams = makeTeams(6)
    const pairings = generateRoundRobinPairings(teams)

    const keys = pairings.map(([a, b]) => `${a.id}-${b.id}`)
    const unique = new Set(keys)
    expect(unique.size).toBe(pairings.length)
  })
})
