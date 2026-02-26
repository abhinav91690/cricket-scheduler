import { describe, it, expect } from "vitest"
import { calculateStandings, type PlayedMatch, type Standing } from "../standings"

describe("calculateStandings", () => {
  it("returns all teams with zeros when no matches played", () => {
    const standings = calculateStandings([1, 2, 3], [])

    expect(standings).toHaveLength(3)
    for (const s of standings) {
      expect(s.played).toBe(0)
      expect(s.won).toBe(0)
      expect(s.lost).toBe(0)
      expect(s.tied).toBe(0)
      expect(s.points).toBe(0)
      expect(s.netRunRate).toBe(0)
    }
  })

  it("awards 2 points for a win and 0 for a loss", () => {
    const matches: PlayedMatch[] = [
      { teamAId: 1, teamBId: 2, teamAScore: 150, teamBScore: 120, winnerId: 1, status: "played" },
    ]
    const standings = calculateStandings([1, 2], matches)

    const team1 = standings.find((s) => s.teamId === 1)!
    const team2 = standings.find((s) => s.teamId === 2)!

    expect(team1.played).toBe(1)
    expect(team1.won).toBe(1)
    expect(team1.lost).toBe(0)
    expect(team1.tied).toBe(0)
    expect(team1.points).toBe(2)

    expect(team2.played).toBe(1)
    expect(team2.won).toBe(0)
    expect(team2.lost).toBe(1)
    expect(team2.tied).toBe(0)
    expect(team2.points).toBe(0)
  })

  it("awards 1 point each for a tie (winnerId is null)", () => {
    const matches: PlayedMatch[] = [
      { teamAId: 1, teamBId: 2, teamAScore: 130, teamBScore: 130, winnerId: null, status: "played" },
    ]
    const standings = calculateStandings([1, 2], matches)

    const team1 = standings.find((s) => s.teamId === 1)!
    const team2 = standings.find((s) => s.teamId === 2)!

    expect(team1.tied).toBe(1)
    expect(team1.points).toBe(1)
    expect(team2.tied).toBe(1)
    expect(team2.points).toBe(1)
  })

  it("calculates net run rate as (scored - conceded) / played", () => {
    const matches: PlayedMatch[] = [
      { teamAId: 1, teamBId: 2, teamAScore: 200, teamBScore: 100, winnerId: 1, status: "played" },
    ]
    const standings = calculateStandings([1, 2], matches)

    const team1 = standings.find((s) => s.teamId === 1)!
    const team2 = standings.find((s) => s.teamId === 2)!

    // team1: (200 - 100) / 1 = 100
    expect(team1.netRunRate).toBe(100)
    // team2: (100 - 200) / 1 = -100
    expect(team2.netRunRate).toBe(-100)
  })

  it("sorts by points desc, then NRR desc", () => {
    const matches: PlayedMatch[] = [
      // Team 1 beats Team 2 by big margin
      { teamAId: 1, teamBId: 2, teamAScore: 200, teamBScore: 100, winnerId: 1, status: "played" },
      // Team 3 beats Team 2 by small margin
      { teamAId: 3, teamBId: 2, teamAScore: 110, teamBScore: 100, winnerId: 3, status: "played" },
      // Team 1 and Team 3 tie
      { teamAId: 1, teamBId: 3, teamAScore: 150, teamBScore: 150, winnerId: null, status: "played" },
    ]
    const standings = calculateStandings([1, 2, 3], matches)

    // Team 1: W1 T1 = 3pts, NRR = (200+150 - 100+150) / 2 = 100/2 = 50
    // Team 3: W1 T1 = 3pts, NRR = (110+150 - 100+150) / 2 = 10/2 = 5
    // Team 2: L2 = 0pts, NRR = (100+100 - 200+110) / 2 = -110/2 = -55
    expect(standings[0].teamId).toBe(1)
    expect(standings[1].teamId).toBe(3)
    expect(standings[2].teamId).toBe(2)
  })

  it("accumulates stats across multiple matches", () => {
    const matches: PlayedMatch[] = [
      { teamAId: 1, teamBId: 2, teamAScore: 150, teamBScore: 120, winnerId: 1, status: "played" },
      { teamAId: 1, teamBId: 3, teamAScore: 180, teamBScore: 160, winnerId: 1, status: "played" },
      { teamAId: 2, teamBId: 3, teamAScore: 140, teamBScore: 140, winnerId: null, status: "played" },
    ]
    const standings = calculateStandings([1, 2, 3], matches)

    const team1 = standings.find((s) => s.teamId === 1)!
    expect(team1.played).toBe(2)
    expect(team1.won).toBe(2)
    expect(team1.lost).toBe(0)
    expect(team1.tied).toBe(0)
    expect(team1.points).toBe(4)

    const team2 = standings.find((s) => s.teamId === 2)!
    expect(team2.played).toBe(2)
    expect(team2.won).toBe(0)
    expect(team2.lost).toBe(1)
    expect(team2.tied).toBe(1)
    expect(team2.points).toBe(1)
  })

  it("includes teams with no matches in the standings", () => {
    const matches: PlayedMatch[] = [
      { teamAId: 1, teamBId: 2, teamAScore: 100, teamBScore: 80, winnerId: 1, status: "played" },
    ]
    // Team 3 has no matches
    const standings = calculateStandings([1, 2, 3], matches)

    expect(standings).toHaveLength(3)
    const team3 = standings.find((s) => s.teamId === 3)!
    expect(team3.played).toBe(0)
    expect(team3.points).toBe(0)
    expect(team3.netRunRate).toBe(0)
  })

  it("won + lost + tied = played for every team", () => {
    const matches: PlayedMatch[] = [
      { teamAId: 1, teamBId: 2, teamAScore: 150, teamBScore: 120, winnerId: 1, status: "played" },
      { teamAId: 1, teamBId: 3, teamAScore: 130, teamBScore: 130, winnerId: null, status: "played" },
      { teamAId: 2, teamBId: 3, teamAScore: 100, teamBScore: 110, winnerId: 3, status: "played" },
    ]
    const standings = calculateStandings([1, 2, 3], matches)

    for (const s of standings) {
      expect(s.won + s.lost + s.tied).toBe(s.played)
    }
  })
})
