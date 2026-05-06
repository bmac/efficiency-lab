import { mulberry32, sampleNormal } from '../../stats.ts'

export type InjectionKind = 'meanShift' | 'varianceIncrease' | 'singleOutlier'

export interface MeanShiftInjection {
  id: string
  kind: 'meanShift'
  startSubgroup: number // 1-based index where the shift takes effect
  delta: number // amount added to the underlying mean from this point onward
}

export interface VarianceIncreaseInjection {
  id: string
  kind: 'varianceIncrease'
  startSubgroup: number
  multiplier: number // sigma multiplier from this point onward (e.g., 2.0)
}

export interface SingleOutlierInjection {
  id: string
  kind: 'singleOutlier'
  atSubgroup: number
  // Multiplier applied to sigma; the outlier is added to *one observation* in that subgroup.
  sigmas: number
}

export type Injection = MeanShiftInjection | VarianceIncreaseInjection | SingleOutlierInjection

export interface ProcessConfig {
  mu: number
  sigma: number
  subgroupSize: number // n
  subgroupCount: number // k
  seed: number
  injections: Injection[]
}

export function generateSubgroups(config: ProcessConfig): number[][] {
  let rand = mulberry32(config.seed)
  let subgroups: number[][] = []

  // Sort injections so we apply them in order; mean shifts and variance multipliers
  // accumulate from their startSubgroup onward.
  let shifts = config.injections
    .filter((i): i is MeanShiftInjection => i.kind === 'meanShift')
    .sort((a, b) => a.startSubgroup - b.startSubgroup)
  let varBumps = config.injections
    .filter((i): i is VarianceIncreaseInjection => i.kind === 'varianceIncrease')
    .sort((a, b) => a.startSubgroup - b.startSubgroup)
  let outliers = config.injections.filter(
    (i): i is SingleOutlierInjection => i.kind === 'singleOutlier',
  )

  for (let i = 0; i < config.subgroupCount; i++) {
    let subgroupIndex = i + 1
    let mu = config.mu
    for (let s of shifts) {
      if (subgroupIndex >= s.startSubgroup) mu += s.delta
    }
    let sigma = config.sigma
    for (let v of varBumps) {
      if (subgroupIndex >= v.startSubgroup) sigma *= v.multiplier
    }
    let group: number[] = []
    for (let j = 0; j < config.subgroupSize; j++) {
      group.push(sampleNormal(rand, mu, sigma))
    }
    for (let o of outliers) {
      if (o.atSubgroup === subgroupIndex && group.length > 0) {
        group[0] += o.sigmas * sigma
      }
    }
    subgroups.push(group)
  }
  return subgroups
}

export function describeInjection(injection: Injection): string {
  switch (injection.kind) {
    case 'meanShift':
      return `Mean shift Δμ=${formatNumber(injection.delta)} at subgroup ${injection.startSubgroup}`
    case 'varianceIncrease':
      return `Variance ×${formatNumber(injection.multiplier)} at subgroup ${injection.startSubgroup}`
    case 'singleOutlier':
      return `Outlier (${formatNumber(injection.sigmas)}σ) at subgroup ${injection.atSubgroup}`
  }
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(2)
}
