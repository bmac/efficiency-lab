import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'

import {
  PROCESSES,
  SteelMill,
  availableProcesses,
  checkOreMismatch,
  getProcess,
  oreMismatchLevel,
  processCost,
  processDefectRate,
  railDemandTons,
  railPriceUsd,
  type MillConfig,
} from '../app/controllers/bessemer/mill.ts'

describe('PROCESSES catalog', () => {
  it('exposes the seven canonical processes', () => {
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

  it('every process has the historically faithful availability year', () => {
    let years = Object.fromEntries(PROCESSES.map((p) => [p.id, p.availableFrom]))
    assert.equal(years['bessemer-acid'], 1856)
    assert.equal(years['open-hearth'], 1865)
    assert.equal(years['bessemer-basic'], 1879)
    assert.ok(years['puddling'] <= 1850)
  })
})

describe('availableProcesses', () => {
  it('gates each process by year', () => {
    let in1850 = availableProcesses(1850).map((p) => p.id)
    assert.ok(in1850.includes('puddling'))
    assert.ok(!in1850.includes('bessemer-acid'))

    let in1856 = availableProcesses(1856).map((p) => p.id)
    assert.ok(in1856.includes('bessemer-acid'))
    assert.ok(!in1856.includes('open-hearth'))

    let in1879 = availableProcesses(1879).map((p) => p.id)
    assert.ok(in1879.includes('bessemer-basic'))
    assert.ok(in1879.includes('open-hearth'))
  })
})

describe('railPriceUsd', () => {
  it('reflects the historical decline from 1867 ($170) to 1898 ($32)', () => {
    let p1867 = railPriceUsd(1867)
    let p1898 = railPriceUsd(1898)
    assert.ok(p1867 > 150 && p1867 < 200, `1867 ~$170, got ${p1867}`)
    assert.ok(p1898 > 25 && p1898 < 40, `1898 ~$32, got ${p1898}`)
    assert.ok(p1898 < p1867)
  })

  it('is monotonic on net across the post-boom decades', () => {
    assert.ok(railPriceUsd(1880) > railPriceUsd(1890))
    assert.ok(railPriceUsd(1890) > railPriceUsd(1900))
    assert.ok(railPriceUsd(1900) >= railPriceUsd(1910))
  })
})

describe('railDemandTons', () => {
  it('grows roughly an order of magnitude per decade across the railroad boom', () => {
    let d1850 = railDemandTons(1850)
    let d1860 = railDemandTons(1860)
    let d1870 = railDemandTons(1870)
    assert.ok(d1860 / d1850 > 3 && d1860 / d1850 < 30, `1860/1850 = ${d1860 / d1850}`)
    assert.ok(d1870 / d1860 > 3 && d1870 / d1860 < 30, `1870/1860 = ${d1870 / d1860}`)
  })

  it('is non-decreasing through 1910', () => {
    for (let y = 1850; y < 1910; y++) {
      assert.ok(railDemandTons(y + 1) >= railDemandTons(y) - 1e-6, `demand drop at ${y}`)
    }
  })
})

describe('checkOreMismatch', () => {
  it('flags Bessemer (acid) on high-P ore as mismatched', () => {
    assert.equal(checkOreMismatch('bessemer-acid', 'high-p'), true)
    assert.equal(checkOreMismatch('bessemer-acid', 'low-p'), false)
  })

  it('does not flag the basic processes on high-P ore', () => {
    assert.equal(checkOreMismatch('bessemer-basic', 'high-p'), false)
    assert.equal(checkOreMismatch('basic-open-hearth', 'high-p'), false)
  })

  it('flags acid open hearth on high-P ore', () => {
    assert.equal(checkOreMismatch('open-hearth', 'high-p'), true)
  })
})

describe('oreMismatchLevel', () => {
  it('reports full mismatch for acid processes on high-P ore', () => {
    assert.equal(oreMismatchLevel('bessemer-acid', 'high-p'), 'full')
    assert.equal(oreMismatchLevel('open-hearth', 'high-p'), 'full')
  })

  it('reports partial mismatch for acid processes on mixed ore', () => {
    assert.equal(oreMismatchLevel('bessemer-acid', 'mixed'), 'partial')
  })

  it('reports no mismatch for basic processes on any ore', () => {
    assert.equal(oreMismatchLevel('bessemer-basic', 'high-p'), 'none')
    assert.equal(oreMismatchLevel('bessemer-basic', 'mixed'), 'none')
    assert.equal(oreMismatchLevel('basic-open-hearth', 'high-p'), 'none')
  })

  it('mixed-ore defects fall between low-P and pure high-P on the same process', () => {
    let year = 1875
    let clean = processDefectRate('bessemer-acid', year, 'none')
    let partial = processDefectRate('bessemer-acid', year, 'partial')
    let full = processDefectRate('bessemer-acid', year, 'full')
    assert.ok(partial > clean, `partial=${partial} should exceed clean=${clean}`)
    assert.ok(full > partial, `full=${full} should exceed partial=${partial}`)
  })
})

describe('processCost teething', () => {
  it('Bessemer in its first year costs more than its mid-life price', () => {
    let mid = getProcess('bessemer-acid').midLifeCostUsdPerTon
    let early = processCost('bessemer-acid', 1857)
    let mature = processCost('bessemer-acid', 1875)
    assert.ok(early > mid * 1.4, `early=${early} vs mid=${mid}`)
    assert.ok(Math.abs(mature - mid) / mid < 0.05, `mature=${mature} vs mid=${mid}`)
  })
})

function makeMill(over: Partial<MillConfig> = {}): SteelMill {
  return new SteelMill({
    startYear: 1850,
    process: 'puddling',
    ore: 'low-p',
    scale: 'regional',
    posture: 'conservative',
    seed: 1,
    ...over,
  })
}

describe('SteelMill', () => {
  it('starts at startYear and advances year on tick', () => {
    let m = makeMill()
    let r = m.tick()
    assert.equal(r.year, 1850)
    assert.equal(m.year, 1851)
  })

  it('rejects switching to a process before its availability year', () => {
    let m = makeMill()
    assert.throws(() => m.setProcess('bessemer-acid'), /not available/i)
  })

  it('records 61 year reports when run 1850 → 1910', () => {
    let m = makeMill()
    let history = m.runUntil(1910)
    assert.equal(history.length, 61)
    assert.equal(history[0].year, 1850)
    assert.equal(history[history.length - 1].year, 1910)
  })

  it('puddling-only rail mill goes bankrupt before 1910', () => {
    let m = makeMill({ process: 'puddling', scale: 'regional' })
    let history = m.runUntil(1910)
    assert.ok(m.bankrupt, 'puddling mill chasing rails should bust')
    let bankruptYear = history.find((h) => h.events.includes('bankrupt'))?.year
    assert.ok(
      bankruptYear != null && bankruptYear < 1910,
      `expected bankrupt year < 1910, got ${bankruptYear}`,
    )
  })

  it('Bessemer adopted in 1857 pays the teething tuition', () => {
    let m = makeMill()
    m.runUntil(1856)
    m.setProcess('bessemer-acid')
    let r = m.tick()
    let mid = getProcess('bessemer-acid').midLifeCostUsdPerTon
    assert.equal(r.year, 1857)
    assert.ok(r.costPerTon > mid * 1.4, `teething cost should be steep, got ${r.costPerTon}`)
  })

  it('Bessemer adopted in 1875 has descended onto the mid-life cost curve', () => {
    let m = makeMill()
    m.runUntil(1874)
    m.setProcess('bessemer-acid')
    let r = m.tick()
    let mid = getProcess('bessemer-acid').midLifeCostUsdPerTon
    assert.ok(Math.abs(r.costPerTon - mid) / mid < 0.05, `mid-life cost expected, got ${r.costPerTon}`)
  })

  it('Bessemer (acid) on high-P ore floods the mill with defects and turns profit negative', () => {
    let m = makeMill({ ore: 'high-p' })
    m.runUntil(1856)
    m.setProcess('bessemer-acid')
    let r = m.tick()
    assert.equal(r.oreMismatch, true)
    assert.ok(r.events.includes('ore-mismatch'))
    assert.ok(r.penalty > 0, 'penalty should fire')
    assert.ok(r.profit < 0, `expected loss-making year, got profit=${r.profit}`)
  })

  it('Thomas-Gilchrist (basic) handles high-P ore without mismatch', () => {
    let m = makeMill({ ore: 'high-p' })
    m.runUntil(1878)
    m.setProcess('bessemer-basic')
    let r = m.tick()
    assert.equal(r.oreMismatch, false)
  })

  it('switching processes books capex that amortizes against subsequent years', () => {
    let m = makeMill({ ore: 'low-p' })
    m.runUntil(1874)
    m.setProcess('bessemer-acid')
    let r = m.tick()
    assert.ok(r.capexAmortized > 0)
  })

  it('Carnegie scale outproduces a small mill on the same process', () => {
    let small = makeMill({ scale: 'small', process: 'bessemer-acid', startYear: 1880 })
    let big = makeMill({ scale: 'carnegie', process: 'bessemer-acid', startYear: 1880 })
    let s = small.tick()
    let b = big.tick()
    assert.ok(
      b.production > s.production * 50,
      `carnegie ${b.production} should be >50× small ${s.production}`,
    )
  })

  it('greenfield mills founded after 1850 book initial capex', () => {
    let greenfield = makeMill({ process: 'bessemer-acid', startYear: 1880, scale: 'carnegie' })
    let r = greenfield.tick()
    assert.ok(
      r.capexAmortized > 0,
      `greenfield mill should amortize starting capex, got ${r.capexAmortized}`,
    )
  })

  it('mills founded at the 1850 baseline do not book initial capex', () => {
    let baseline = makeMill()
    let r = baseline.tick()
    assert.equal(r.capexAmortized, 0)
  })

  it('1873 panic year fires as an event', () => {
    let m = makeMill({ process: 'bessemer-acid', startYear: 1872 })
    m.tick() // 1872 — no event
    let r1873 = m.tick()
    assert.ok(r1873.events.includes('panic-1873'))
  })

  it('runs deterministically for a fixed seed', () => {
    let a = makeMill({ seed: 9 })
    let b = makeMill({ seed: 9 })
    let ah = a.runUntil(1900).map((r) => r.profit)
    let bh = b.runUntil(1900).map((r) => r.profit)
    assert.deepEqual(ah, bh)
  })

  it('competitor strategies run alongside without sharing state', () => {
    let m = makeMill({ process: 'bessemer-acid', startYear: 1880, scale: 'carnegie' })
    let n = makeMill({ process: 'puddling', startYear: 1880, scale: 'small' })
    m.runUntil(1900)
    n.runUntil(1900)
    let mLast = m.history[m.history.length - 1]
    let nLast = n.history[n.history.length - 1]
    assert.ok(
      mLast.cumulativeProfit > nLast.cumulativeProfit,
      `bessemer/carnegie should out-earn small puddling: ${mLast.cumulativeProfit} vs ${nLast.cumulativeProfit}`,
    )
  })
})
