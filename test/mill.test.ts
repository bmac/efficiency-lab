import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  COMPETITORS,
  Mill,
  PROCESSES,
  costPerTon,
  defectRateFor,
  effectiveDefectRate,
  marketPriceForYear,
  railDemandForYear,
  type ProcessId,
} from '../app/controllers/bessemer/mill.ts'

function defaultMill(overrides: Partial<ConstructorParameters<typeof Mill>[0]> = {}) {
  return new Mill({
    startYear: 1850,
    process: 'puddling',
    ore: 'low-p',
    scale: 'regional',
    posture: 'conservative',
    seed: 1,
    ...overrides,
  })
}

describe('PROCESSES catalog', () => {
  it('exposes all seven historical processes', () => {
    let ids = PROCESSES.map((p) => p.id).sort()
    assert.deepEqual(ids, [
      'basic-open-hearth',
      'bessemer-acid',
      'bessemer-basic',
      'cementation',
      'crucible',
      'open-hearth',
      'puddling',
    ])
  })

  it('lists historical availability years matching the PRD', () => {
    let byId: Record<string, number> = {}
    for (let p of PROCESSES) byId[p.id] = p.availableYear
    assert.equal(byId['cementation'], 1850)
    assert.equal(byId['crucible'], 1850)
    assert.equal(byId['puddling'], 1850)
    assert.equal(byId['bessemer-acid'], 1856)
    assert.equal(byId['open-hearth'], 1865)
    assert.equal(byId['bessemer-basic'], 1879)
    assert.equal(byId['basic-open-hearth'], 1880)
  })

  it('marks Bessemer (acid) as low-phosphorus only', () => {
    let bessemer = PROCESSES.find((p) => p.id === 'bessemer-acid')!
    assert.equal(bessemer.oreConstraint, 'low-p')
  })

  it('marks Thomas-Gilchrist (basic Bessemer) as handling high-P ores', () => {
    let basic = PROCESSES.find((p) => p.id === 'bessemer-basic')!
    assert.notEqual(basic.oreConstraint, 'low-p')
  })
})

describe('cost and defect curves', () => {
  it('Bessemer mid-life cost is below puddling mid-life cost', () => {
    let bessemerMid = costPerTon('bessemer-acid', 30)
    let puddlingMid = costPerTon('puddling', 30)
    assert.ok(
      bessemerMid < puddlingMid,
      `expected mature Bessemer ($${bessemerMid}) < puddling ($${puddlingMid})`,
    )
  })

  it('teething period costs are at least 40% higher than mid-life', () => {
    let early = costPerTon('bessemer-acid', 0)
    let mature = costPerTon('bessemer-acid', 20)
    assert.ok(
      early >= mature * 1.4,
      `expected early Bessemer cost ($${early}) >= 1.4× mature ($${mature})`,
    )
  })

  it('defect rate is high during teething and drops after', () => {
    let early = defectRateFor('bessemer-acid', 0)
    let mature = defectRateFor('bessemer-acid', 20)
    assert.ok(early > mature, `expected early defect ${early} > mature ${mature}`)
    assert.ok(mature < 0.05, `mature defect rate should be modest, got ${mature}`)
  })

  it('cost/ton is monotone non-increasing across the teething period', () => {
    let last = Infinity
    for (let y = 0; y <= 12; y++) {
      let c = costPerTon('bessemer-acid', y)
      assert.ok(
        c <= last + 1e-9,
        `cost should not rise during teething: y=${y} c=${c} prev=${last}`,
      )
      last = c
    }
  })
})

describe('ore compatibility', () => {
  it('penalises Bessemer (acid) on high-P ore with a much higher defect rate', () => {
    let compat = effectiveDefectRate('bessemer-acid', 'low-p', 5)
    let mismatch = effectiveDefectRate('bessemer-acid', 'high-p', 5)
    assert.ok(
      mismatch >= compat * 3,
      `expected ore mismatch defect (${mismatch}) >= 3× compatible (${compat})`,
    )
  })

  it('does not penalise basic Bessemer on high-P ore', () => {
    let compat = effectiveDefectRate('bessemer-basic', 'low-p', 5)
    let highP = effectiveDefectRate('bessemer-basic', 'high-p', 5)
    assert.ok(highP <= compat * 1.2, 'basic process should handle high-P cleanly')
  })

  it('puddling has no ore penalty', () => {
    let lowP = effectiveDefectRate('puddling', 'low-p', 5)
    let highP = effectiveDefectRate('puddling', 'high-p', 5)
    assert.equal(lowP, highP)
  })
})

describe('market price and demand curves', () => {
  it('rail price falls from 1850 to 1900', () => {
    let p1850 = marketPriceForYear(1850)
    let p1898 = marketPriceForYear(1898)
    assert.ok(p1850 > p1898, `expected price decline ${p1850} -> ${p1898}`)
    assert.ok(p1898 < 50, `1898 rail price should be near $32, got $${p1898}`)
    assert.ok(p1898 > 20, `1898 rail price should be near $32, got $${p1898}`)
  })

  it('rail demand grows by roughly 10× per decade between 1850 and 1900', () => {
    let d1860 = railDemandForYear(1860)
    let d1870 = railDemandForYear(1870)
    let ratio = d1870 / d1860
    assert.ok(ratio >= 4 && ratio <= 20, `expected ~10×/decade growth, got ${ratio}`)
  })
})

describe('Mill — single year tick', () => {
  it('starts in 1850 with positive cash and the puddling process', () => {
    let mill = defaultMill()
    let snap = mill.snapshot()
    assert.equal(snap.year, 1850)
    assert.equal(snap.process, 'puddling')
    assert.ok(snap.cash > 0)
    assert.equal(snap.bankrupt, false)
  })

  it('advances year by 1 on tick', () => {
    let mill = defaultMill()
    mill.tick()
    assert.equal(mill.snapshot().year, 1851)
  })

  it('records yearly history of profit/cost/revenue', () => {
    let mill = defaultMill()
    mill.tick()
    mill.tick()
    let snap = mill.snapshot()
    assert.equal(snap.history.length, 2)
    assert.ok(typeof snap.history[0].profit === 'number')
    assert.ok(typeof snap.history[0].revenue === 'number')
    assert.ok(typeof snap.history[0].cost === 'number')
  })
})

describe('Mill — process switching', () => {
  it('refuses to adopt a process before its historical availability', () => {
    let mill = defaultMill({ startYear: 1855 })
    assert.throws(
      () => mill.adoptProcess('bessemer-acid'),
      /not yet available/i,
    )
  })

  it('allows adopting Bessemer in 1856 at 1856 year', () => {
    let mill = defaultMill()
    while (mill.snapshot().year < 1856) mill.tick()
    mill.adoptProcess('bessemer-acid')
    let snap = mill.snapshot()
    assert.equal(snap.process, 'bessemer-acid')
    assert.equal(snap.yearsSinceAdoption, 0)
    assert.ok(snap.retoolingYearsLeft >= 1, 'retooling stops production for 1+ years')
  })

  it('zero production while retooling', () => {
    let mill = defaultMill({ startYear: 1860 })
    let cashBefore = mill.snapshot().cash
    mill.adoptProcess('bessemer-acid')
    let capexHit = cashBefore - mill.snapshot().cash
    assert.ok(capexHit > 0, 'switching pays capex up front')
    mill.tick()
    let h = mill.snapshot().history
    let lastYear = h[h.length - 1]
    assert.equal(lastYear.production, 0)
  })
})

describe('Mill — long-run dynamics', () => {
  it('a puddling-only mill serving rails compresses to bankruptcy by 1910', () => {
    let mill = defaultMill({ startYear: 1850 })
    while (mill.snapshot().year < 1910 && !mill.snapshot().bankrupt) {
      mill.tick()
    }
    assert.equal(mill.snapshot().bankrupt, true, 'puddling rails mill should bust')
  })

  it('an early Bessemer adopter on low-P ore is profitable by 1880', () => {
    let mill = defaultMill({ startYear: 1850, scale: 'regional' })
    while (mill.snapshot().year < 1858) mill.tick()
    mill.adoptProcess('bessemer-acid')
    while (mill.snapshot().year < 1880) mill.tick()
    let snap = mill.snapshot()
    assert.equal(snap.bankrupt, false, 'early Bessemer mill should survive')
    assert.ok(snap.cash > 0, `expected cash > 0 in 1880, got $${snap.cash}`)
  })

  it('Bessemer on high-P ore loses money compared to Bessemer on low-P', () => {
    let mismatched = defaultMill({ startYear: 1850, ore: 'high-p' })
    let matched = defaultMill({ startYear: 1850, ore: 'low-p' })
    while (mismatched.snapshot().year < 1858) {
      mismatched.tick()
      matched.tick()
    }
    mismatched.adoptProcess('bessemer-acid')
    matched.adoptProcess('bessemer-acid')
    while (matched.snapshot().year < 1880) {
      mismatched.tick()
      matched.tick()
    }
    assert.ok(
      matched.snapshot().cash > mismatched.snapshot().cash,
      `low-P should outperform high-P with acid Bessemer`,
    )
  })
})

describe('Mill — determinism', () => {
  it('two mills with the same seed and decisions produce the same history', () => {
    let a = defaultMill({ seed: 99 })
    let b = defaultMill({ seed: 99 })
    for (let i = 0; i < 30; i++) {
      a.tick()
      b.tick()
    }
    let ha = a.snapshot().history
    let hb = b.snapshot().history
    assert.equal(ha.length, hb.length)
    for (let i = 0; i < ha.length; i++) {
      assert.equal(ha[i].profit, hb[i].profit)
      assert.equal(ha[i].cost, hb[i].cost)
    }
  })
})

describe('COMPETITORS', () => {
  it('exposes three named competitor strategies', () => {
    assert.equal(COMPETITORS.length, 3)
    let names = COMPETITORS.map((c) => c.name).sort()
    assert.ok(names.some((n) => /crucible/i.test(n)))
    assert.ok(names.some((n) => /carnegie/i.test(n)))
    assert.ok(names.some((n) => /bessemer/i.test(n)))
  })

  it('competitor strategies produce a deterministic schedule of process choices', () => {
    let crucible = COMPETITORS.find((c) => /crucible/i.test(c.name))!
    let pioneer = COMPETITORS.find((c) => /bessemer/i.test(c.name))!
    let earlyChoice = pioneer.chooseProcess(1858, 'puddling') as ProcessId
    assert.equal(earlyChoice, 'bessemer-acid')
    let crucibleChoice = crucible.chooseProcess(1880, 'crucible')
    assert.equal(crucibleChoice, 'crucible')
  })
})
