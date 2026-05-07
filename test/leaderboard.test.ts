import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'

import { computeLeaderboard } from '../app/controllers/red-beads/leaderboard.ts'

describe('computeLeaderboard', () => {
  it('returns an empty board when there are no workers', () => {
    assert.deepEqual(computeLeaderboard([], []), [])
  })

  it('leaves every entry unranked when no rounds have been played', () => {
    let board = computeLeaderboard([{ name: 'Alex' }, { name: 'Bao' }], [])
    assert.equal(board.length, 2)
    for (let e of board) {
      assert.equal(e.rank, null)
      assert.equal(e.meanReds, null)
      assert.equal(e.roundsPlayed, 0)
      assert.equal(e.total, 0)
    }
  })

  it('ranks by mean reds per round, lower being better', () => {
    let board = computeLeaderboard(
      [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      [
        [
          { workerName: 'A', redCount: 5 },
          { workerName: 'B', redCount: 10 },
          { workerName: 'C', redCount: 8 },
        ],
      ],
    )
    let byName = new Map(board.map((b) => [b.name, b]))
    assert.equal(byName.get('A')?.rank, 1)
    assert.equal(byName.get('C')?.rank, 2)
    assert.equal(byName.get('B')?.rank, 3)
  })

  it('does not rank a newly-hired worker with zero rounds played', () => {
    let board = computeLeaderboard(
      [{ name: 'A' }, { name: 'B' }, { name: 'New' }],
      [
        [
          { workerName: 'A', redCount: 8 },
          { workerName: 'B', redCount: 12 },
        ],
        [
          { workerName: 'A', redCount: 10 },
          { workerName: 'B', redCount: 14 },
        ],
      ],
    )
    let byName = new Map(board.map((b) => [b.name, b]))
    assert.equal(byName.get('New')?.rank, null, 'new worker should not be ranked')
    assert.equal(byName.get('New')?.roundsPlayed, 0)
    assert.equal(byName.get('A')?.rank, 1, 'A has the lower mean (9 vs 13)')
    assert.equal(byName.get('B')?.rank, 2)
  })

  it('ranks by mean rather than cumulative when rounds-played differ', () => {
    // C played 1 round (mean 5). A played 2 rounds (total 12, mean 6).
    // C has higher mean? No — lower mean wins; C's mean is 5, A's is 6.
    let board = computeLeaderboard(
      [{ name: 'A' }, { name: 'C' }],
      [
        [
          { workerName: 'A', redCount: 6 },
          { workerName: 'C', redCount: 5 },
        ],
        [{ workerName: 'A', redCount: 6 }],
      ],
    )
    let byName = new Map(board.map((b) => [b.name, b]))
    assert.equal(byName.get('C')?.rank, 1)
    assert.equal(byName.get('A')?.rank, 2)
    assert.equal(byName.get('A')?.total, 12)
    assert.equal(byName.get('A')?.roundsPlayed, 2)
    assert.equal(byName.get('A')?.meanReds, 6)
    assert.equal(byName.get('C')?.total, 5)
    assert.equal(byName.get('C')?.roundsPlayed, 1)
    assert.equal(byName.get('C')?.meanReds, 5)
  })

  it('sorts unranked workers to the end of the board', () => {
    let board = computeLeaderboard(
      [{ name: 'New' }, { name: 'Alex' }, { name: 'Bao' }],
      [
        [
          { workerName: 'Alex', redCount: 10 },
          { workerName: 'Bao', redCount: 5 },
        ],
      ],
    )
    assert.equal(board[0].name, 'Bao')
    assert.equal(board[1].name, 'Alex')
    assert.equal(board[2].name, 'New')
    assert.equal(board[2].rank, null)
  })
})
