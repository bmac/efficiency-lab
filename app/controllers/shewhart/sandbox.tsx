import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'

import {
  WESTERN_ELECTRIC_RULES,
  detectWesternElectric,
  mean,
  rangeOf,
  xbarRLimits,
} from '../../stats.ts'
import { ControlChart, type PointFlag } from '../../ui/control-chart.tsx'
import {
  DraftingButton,
  FieldSlider,
  Panel,
  Readout,
  SheetHeader,
  T,
} from '../../ui/shell.tsx'
import {
  describeInjection,
  generateSubgroups,
  type Injection,
  type InjectionKind,
} from './process.ts'

interface ShewhartSandboxProps extends SerializableProps {}

const RULE_COLOR: Record<1 | 2 | 3 | 4, string> = {
  1: T.accent,
  2: T.warn,
  3: T.warn,
  4: T.ink,
}

export const ShewhartSandbox = clientEntry(
  '/assets/app/controllers/shewhart/sandbox.tsx#ShewhartSandbox',
  function ShewhartSandbox(handle: Handle<ShewhartSandboxProps>) {
    let nextInjectionId = 1

    let config = {
      mu: 10,
      sigma: 1,
      subgroupSize: 5,
      subgroupCount: 30,
      seed: 1,
      injections: [] as Injection[],
    }
    let baselineCount = 25

    function update() {
      handle.update()
    }

    function addInjection(kind: InjectionKind) {
      let id = `inj-${nextInjectionId++}`
      let mid = Math.max(1, Math.floor(config.subgroupCount / 2))
      let next: Injection
      if (kind === 'meanShift') {
        next = { id, kind, startSubgroup: mid, delta: config.sigma }
      } else if (kind === 'varianceIncrease') {
        next = { id, kind, startSubgroup: mid, multiplier: 2 }
      } else {
        next = { id, kind, atSubgroup: mid, sigmas: 4 }
      }
      config.injections = [...config.injections, next]
      update()
    }

    function removeInjection(id: string) {
      config.injections = config.injections.filter((i) => i.id !== id)
      update()
    }

    function updateInjection(id: string, patch: Partial<Injection>) {
      config.injections = config.injections.map((i) =>
        i.id === id ? ({ ...i, ...patch } as Injection) : i,
      )
      update()
    }

    function reshuffle() {
      config.seed = Math.floor(Math.random() * 10_000)
      update()
    }

    function clearInjections() {
      config.injections = []
      update()
    }

    return () => {
      let subgroups = generateSubgroups(config)
      let means = subgroups.map(mean)
      let ranges = subgroups.map(rangeOf)

      let effectiveBaseline = Math.max(2, Math.min(config.subgroupCount - 1, baselineCount))
      let baseline = subgroups.slice(0, effectiveBaseline)
      let limits = xbarRLimits(baseline)

      let sigmaXbar = limits.hasLimits ? (limits.uclX - limits.xbar) / 3 : 0
      let violations = limits.hasLimits
        ? detectWesternElectric(means, limits.xbar, sigmaXbar)
        : means.map(() => [])

      let flags: (PointFlag | undefined)[] = means.map((_, i) => {
        let firedRules = violations[i]
        if (firedRules.length === 0) return undefined
        let primary = firedRules[0]
        let descriptions = firedRules.map(
          (n) => `Rule ${n}: ${WESTERN_ELECTRIC_RULES[n].description}`,
        )
        return { color: RULE_COLOR[primary], tooltip: descriptions.join(' | ') }
      })

      let pointTooltips = means.map((v, i) => {
        let firedRules = violations[i]
        let suffix =
          firedRules.length > 0
            ? ` — Rule${firedRules.length > 1 ? 's' : ''} ${firedRules.join(', ')}`
            : ''
        return `Subgroup ${i + 1}: x̄ = ${v.toFixed(3)}${suffix}`
      })

      let zones =
        sigmaXbar > 0
          ? [
              { inner: limits.xbar, outer: limits.xbar + sigmaXbar, label: '+1σ' },
              { inner: limits.xbar, outer: limits.xbar - sigmaXbar, label: '−1σ' },
              { inner: limits.xbar, outer: limits.xbar + 2 * sigmaXbar, label: '+2σ' },
              { inner: limits.xbar, outer: limits.xbar - 2 * sigmaXbar, label: '−2σ' },
            ]
          : []

      // Tally rule violations for the WE panel.
      let countsByRule: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      for (let row of violations) {
        for (let n of row) countsByRule[n]++
      }

      return (
        <article mix={pageStyle}>
          <SheetHeader
            fig="Fig. 2.0 — Process control sandbox"
            title="Shewhart Sandbox"
            subtitle="Generate a stable process. Inject special causes. Watch the chart over-react. The hardest part of SPC isn't the math — it's not reacting to common-cause variation."
          />

          <div mix={twoColStyle}>
            <div mix={mainColumnStyle}>
              <Panel label="Fig. 2.1 — X̄ chart (subgroup means)" padding={20}>
                <ControlChart
                  title=""
                  points={means}
                  cl={limits.xbar}
                  ucl={limits.uclX}
                  lcl={limits.lclX}
                  yLabel="Mean"
                  xLabel="Subgroup"
                  zones={zones}
                  baselineCutoff={effectiveBaseline}
                  flags={flags}
                  pointTooltips={pointTooltips}
                />
              </Panel>

              <Panel label="Fig. 2.2 — R chart (subgroup ranges)" padding={20}>
                <ControlChart
                  title=""
                  points={ranges}
                  cl={limits.rbar}
                  ucl={limits.uclR}
                  lcl={limits.lclR}
                  yLabel="Range"
                  xLabel="Subgroup"
                  baselineCutoff={effectiveBaseline}
                />
              </Panel>

              <Panel label="Western Electric audit · 4-rule panel" padding={20}>
                <div mix={ruleGridStyle}>
                  {([1, 2, 3, 4] as const).map((n) => (
                    <RuleCell key={`rule-${n}`} number={n} hits={countsByRule[n]} />
                  ))}
                </div>
              </Panel>

              {config.injections.length > 0 && (
                <Panel label="Active injections" padding={18}>
                  <ul mix={summaryListStyle}>
                    {config.injections.map((inj) => (
                      <li key={`s-${inj.id}`} mix={summaryItemStyle}>
                        {describeInjection(inj)}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>

            <aside mix={asideStyle}>
              <Panel label="Process · Params" padding={16}>
                <FieldSlider
                  label="μ (process mean)"
                  value={config.mu}
                  min={0}
                  max={20}
                  step={0.1}
                  format={(v) => v.toFixed(2)}
                  onChange={(v) => {
                    config.mu = v
                    update()
                  }}
                />
                <FieldSlider
                  label="σ (process sigma)"
                  value={config.sigma}
                  min={0.1}
                  max={3}
                  step={0.05}
                  format={(v) => v.toFixed(2)}
                  onChange={(v) => {
                    config.sigma = v
                    update()
                  }}
                />
                <FieldSlider
                  label="n (subgroup size)"
                  value={config.subgroupSize}
                  min={2}
                  max={10}
                  step={1}
                  onChange={(v) => {
                    config.subgroupSize = Math.round(v)
                    update()
                  }}
                />
                <FieldSlider
                  label="k (subgroups)"
                  value={config.subgroupCount}
                  min={10}
                  max={80}
                  step={1}
                  onChange={(v) => {
                    config.subgroupCount = Math.round(v)
                    if (baselineCount > config.subgroupCount - 1) {
                      baselineCount = Math.max(2, config.subgroupCount - 1)
                    }
                    update()
                  }}
                />
                <FieldSlider
                  label="Baseline window"
                  value={baselineCount}
                  min={2}
                  max={Math.max(2, config.subgroupCount - 1)}
                  step={1}
                  onChange={(v) => {
                    baselineCount = Math.round(v)
                    update()
                  }}
                />
                <FieldSlider
                  label="Seed"
                  value={config.seed}
                  min={1}
                  max={9999}
                  step={1}
                  format={(v) => String(Math.round(v)).padStart(5, '0')}
                  onChange={(v) => {
                    config.seed = Math.round(v)
                    update()
                  }}
                />
                <DraftingButton primary full onClick={reshuffle}>
                  ↻ Re-shuffle seed
                </DraftingButton>
              </Panel>

              <Panel label="Inject · Special cause" padding={16}>
                <div mix={injectButtonsStyle}>
                  <DraftingButton onClick={() => addInjection('meanShift')}>
                    + Mean shift
                  </DraftingButton>
                  <DraftingButton onClick={() => addInjection('varianceIncrease')}>
                    + Variance ×
                  </DraftingButton>
                  <DraftingButton onClick={() => addInjection('singleOutlier')}>
                    + Outlier
                  </DraftingButton>
                  <DraftingButton
                    onClick={clearInjections}
                    disabled={config.injections.length === 0}
                  >
                    Clear all
                  </DraftingButton>
                </div>
                {config.injections.length > 0 && (
                  <ul mix={editorListStyle}>
                    {config.injections.map((injection) => (
                      <InjectionEditor
                        key={`e-${injection.id}`}
                        injection={injection}
                        maxSubgroup={config.subgroupCount}
                        onUpdate={(patch) => updateInjection(injection.id, patch)}
                        onRemove={() => removeInjection(injection.id)}
                      />
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel label="Computed limits" padding={16}>
                <Readout k="X̄̄" v={limits.xbar.toFixed(3)} accent />
                <Readout k="R̄" v={limits.rbar.toFixed(3)} />
                <Readout k="σ̂ (xbar)" v={sigmaXbar.toFixed(3)} />
                <Readout k="UCL X̄" v={limits.uclX.toFixed(3)} />
                <Readout k="LCL X̄" v={limits.lclX.toFixed(3)} />
                <Readout
                  k="Violations"
                  v={`${countsByRule[1] + countsByRule[2] + countsByRule[3] + countsByRule[4]}`}
                  accent={
                    countsByRule[1] + countsByRule[2] + countsByRule[3] + countsByRule[4] > 0
                  }
                />
              </Panel>

              <Panel label="Drafting note" padding={16}>
                <div mix={noteStyle}>
                  Inject a mean shift, then watch how slowly Rule 4 catches it. Detection lags
                  reality. The temptation is to "do something" before the chart says so.
                </div>
              </Panel>
            </aside>
          </div>
        </article>
      )
    }
  },
)

function RuleCell(handle: Handle<{ number: 1 | 2 | 3 | 4; hits: number }>) {
  return () => {
    let { number, hits } = handle.props
    let active = hits > 0
    return (
      <div mix={active ? ruleCellActiveStyle : ruleCellStyle}>
        <div mix={ruleNumStyle}>RULE {number}</div>
        <div mix={ruleDescStyle}>{WESTERN_ELECTRIC_RULES[number].description}</div>
        <div mix={active ? ruleStatActiveStyle : ruleStatStyle}>
          {active ? `▲ ${hits} VIOLATION${hits === 1 ? '' : 'S'}` : '○ NO VIOLATIONS'}
        </div>
      </div>
    )
  }
}

function InjectionEditor(
  handle: Handle<{
    injection: Injection
    maxSubgroup: number
    onUpdate: (patch: Partial<Injection>) => void
    onRemove: () => void
  }>,
) {
  return () => {
    let { injection, maxSubgroup, onUpdate, onRemove } = handle.props
    return (
      <li mix={editorCardStyle}>
        <div mix={editorHeaderStyle}>
          <span mix={editorKindStyle}>{kindLabel(injection.kind)}</span>
          <button type="button" mix={[iconButtonStyle, on('click', onRemove)]} aria-label="Remove">
            ×
          </button>
        </div>
        <FieldSlider
          label={
            injection.kind === 'singleOutlier'
              ? 'At subgroup'
              : 'From subgroup'
          }
          value={
            injection.kind === 'singleOutlier'
              ? injection.atSubgroup
              : injection.startSubgroup
          }
          min={1}
          max={maxSubgroup}
          step={1}
          onChange={(v) => {
            let n = Math.round(v)
            if (injection.kind === 'singleOutlier') {
              onUpdate({ atSubgroup: n } as Partial<Injection>)
            } else {
              onUpdate({ startSubgroup: n } as Partial<Injection>)
            }
          }}
        />
        {injection.kind === 'meanShift' && (
          <FieldSlider
            label="Δμ"
            value={injection.delta}
            min={-10}
            max={10}
            step={0.1}
            format={(v) => v.toFixed(2)}
            onChange={(v) => onUpdate({ delta: v } as Partial<Injection>)}
          />
        )}
        {injection.kind === 'varianceIncrease' && (
          <FieldSlider
            label="σ ×"
            value={injection.multiplier}
            min={0.5}
            max={5}
            step={0.1}
            format={(v) => v.toFixed(2)}
            onChange={(v) => onUpdate({ multiplier: v } as Partial<Injection>)}
          />
        )}
        {injection.kind === 'singleOutlier' && (
          <FieldSlider
            label="Magnitude"
            unit="σ"
            value={injection.sigmas}
            min={-10}
            max={10}
            step={0.5}
            format={(v) => v.toFixed(1)}
            onChange={(v) => onUpdate({ sigmas: v } as Partial<Injection>)}
          />
        )}
      </li>
    )
  }
}

function kindLabel(kind: InjectionKind): string {
  switch (kind) {
    case 'meanShift':
      return 'Mean shift'
    case 'varianceIncrease':
      return 'Variance ×'
    case 'singleOutlier':
      return 'Single outlier'
  }
}

// -------------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------------

const pageStyle = css({
  fontFamily: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace',
  color: T.ink,
  display: 'flex',
  flexDirection: 'column',
  gap: '28px',
})

const twoColStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
  gap: '24px',
  alignItems: 'flex-start',
  '@media (max-width: 1100px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const mainColumnStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  minWidth: 0,
})

const asideStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  position: 'sticky',
  top: '96px',
  '@media (max-width: 1100px)': { position: 'static', top: 'auto' },
})

const ruleGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '10px',
  '@media (max-width: 720px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
})

const ruleCellStyle = css({
  border: `1px solid ${T.ink}`,
  padding: '12px',
  background: 'transparent',
})

const ruleCellActiveStyle = css({
  border: `1px solid ${T.accent}`,
  padding: '12px',
  background: T.accentSoft,
})

const ruleNumStyle = css({
  fontSize: '10px',
  letterSpacing: '0.16em',
  fontWeight: 700,
})

const ruleDescStyle = css({
  marginTop: '6px',
  fontSize: '11px',
  lineHeight: 1.4,
  opacity: 0.85,
})

const ruleStatStyle = css({
  marginTop: '10px',
  fontSize: '10px',
  letterSpacing: '0.14em',
  fontWeight: 700,
  color: T.ink,
})

const ruleStatActiveStyle = css({
  marginTop: '10px',
  fontSize: '10px',
  letterSpacing: '0.14em',
  fontWeight: 700,
  color: T.accent,
})

const summaryListStyle = css({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
})

const summaryItemStyle = css({
  fontSize: '11px',
  paddingTop: '6px',
  borderTop: `1px dashed ${T.ink}`,
  '&:first-child': { borderTop: 'none', paddingTop: 0 },
})

const injectButtonsStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '6px',
})

const editorListStyle = css({
  margin: '12px 0 0',
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
})

const editorCardStyle = css({
  border: `1px solid ${T.ink}`,
  padding: '10px',
})

const editorHeaderStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px',
})

const editorKindStyle = css({
  fontSize: '10px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: T.accent,
})

const iconButtonStyle = css({
  appearance: 'none',
  background: 'transparent',
  border: `1px solid ${T.ink}`,
  width: '24px',
  height: '24px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '14px',
  lineHeight: 1,
  color: T.ink,
  '&:hover': { background: T.accent, color: T.paper, borderColor: T.accent },
})

const noteStyle = css({
  fontSize: '11px',
  lineHeight: 1.55,
})
