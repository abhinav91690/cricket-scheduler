export interface PlayedMatch {
  teamAId: number
  teamBId: number
  teamAScore: number
  teamBScore: number
  winnerId: number | null // null = tie
  status: "played"
}

export interface Standing {
  teamId: number
  played: number
  won: number
  lost: number
  tied: number
  points: number // win=2, tie=1, loss=0
  netRunRate: number // (totalScored - totalConceded) / played
}

export function calculateStandings(
  teamIds: number[],
  playedMatches: PlayedMatch[]
): Standing[] {
  const map = new Map<number, Standing>()

  for (const id of teamIds) {
    map.set(id, {
      teamId: id,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
      netRunRate: 0,
    })
  }

  // Track raw scored/conceded for NRR calculation
  const scored = new Map<number, number>()
  const conceded = new Map<number, number>()
  for (const id of teamIds) {
    scored.set(id, 0)
    conceded.set(id, 0)
  }

  for (const match of playedMatches) {
    const a = map.get(match.teamAId)
    const b = map.get(match.teamBId)
    if (!a || !b) continue

    a.played++
    b.played++

    scored.set(match.teamAId, (scored.get(match.teamAId) ?? 0) + match.teamAScore)
    conceded.set(match.teamAId, (conceded.get(match.teamAId) ?? 0) + match.teamBScore)
    scored.set(match.teamBId, (scored.get(match.teamBId) ?? 0) + match.teamBScore)
    conceded.set(match.teamBId, (conceded.get(match.teamBId) ?? 0) + match.teamAScore)

    if (match.winnerId === null) {
      a.tied++
      b.tied++
      a.points += 1
      b.points += 1
    } else if (match.winnerId === match.teamAId) {
      a.won++
      b.lost++
      a.points += 2
    } else {
      b.won++
      a.lost++
      b.points += 2
    }
  }

  // Calculate NRR
  for (const s of map.values()) {
    if (s.played > 0) {
      s.netRunRate =
        ((scored.get(s.teamId) ?? 0) - (conceded.get(s.teamId) ?? 0)) /
        s.played
    }
  }

  // Sort by points desc, then NRR desc
  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.netRunRate - a.netRunRate
  })
}
