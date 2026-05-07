export interface LeaderboardEntry {
  name: string
  total: number
  roundsPlayed: number
  // Null until the worker has scooped at least once.
  meanReds: number | null
  // Null for workers with no rounds played; otherwise 1-based among those who have.
  rank: number | null
}

export function computeLeaderboard(
  workers: readonly { name: string }[],
  rounds: readonly (readonly { workerName: string; redCount: number }[])[],
): LeaderboardEntry[] {
  let entries: LeaderboardEntry[] = workers.map((w) => {
    let total = 0
    let roundsPlayed = 0
    for (let r of rounds) {
      for (let d of r) {
        if (d.workerName === w.name) {
          total += d.redCount
          roundsPlayed++
        }
      }
    }
    return {
      name: w.name,
      total,
      roundsPlayed,
      meanReds: roundsPlayed > 0 ? total / roundsPlayed : null,
      rank: null,
    }
  })

  entries.sort((a, b) => {
    if (a.meanReds == null && b.meanReds == null) return 0
    if (a.meanReds == null) return 1
    if (b.meanReds == null) return -1
    return a.meanReds - b.meanReds
  })

  let nextRank = 1
  for (let e of entries) {
    if (e.meanReds != null) {
      e.rank = nextRank++
    }
  }

  return entries
}
