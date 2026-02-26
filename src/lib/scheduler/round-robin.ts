export type TeamRef = { id: number; name: string }

export type Pairing = [TeamRef, TeamRef]

export function generateRoundRobinPairings(teams: TeamRef[]): Pairing[] {
  if (teams.length < 2) {
    throw new Error(
      `Round-robin requires at least 2 teams, got ${teams.length}`
    )
  }

  const pairings: Pairing[] = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      pairings.push([teams[i], teams[j]])
    }
  }
  return pairings
}
