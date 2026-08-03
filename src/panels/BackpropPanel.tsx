import { useState } from 'react';
import type { GradientRecord, GradLayer, EpochRecord } from '../hooks/useTraining';
import { GRAD_LAYERS } from '../hooks/useTraining';

const LAYER_COLORS: Record<GradLayer, string> = {
  output: '#a78bfa', fc2: '#22c55e', drop1: '#f43f5e',
  fc1: '#22c55e', pool3: '#f59e0b', conv4: '#22d3ee',
  pool2: '#f59e0b', conv3: '#22d3ee', conv2: '#22d3ee',
  pool1: '#f59e0b', conv1: '#22d3ee',
};

// ─── Gradient flow bar chart ─────────────────────────────────────────────────

function GradFlowBar({ record }: { record: GradientRecord }) {
  const maxNorm = Math.max(...GRAD_LAYERS.map(l => record.gradNorms[l]), 1e-9);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {GRAD_LAYERS.map(layer => {
        const norm = record.gradNorms[layer];
        const upd  = record.weightUpd[layer];
        const pct  = Math.min(100, (norm / maxNorm) * 100);
        const color = LAYER_COLORS[layer];
        return (
          <div key={layer} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 44, fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{layer}</span>
            <div style={{ flex: 1, height: 10, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, opacity: 0.85, transition: 'width 0.3s' }}/>
            </div>
            <span style={{ width: 50, fontSize: 8, color, fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0 }}>
              {norm < 0.001 ? norm.toExponential(1) : norm.toFixed(4)}
            </span>
            <span style={{ width: 54, fontSize: 8, color: '#475569', fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0 }}>
              Δw {upd < 0.0001 ? upd.toExponential(1) : upd.toFixed(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Per-layer sparkline ─────────────────────────────────────────────────────

function GradSparkline({ gradHistory, layer }: { gradHistory: GradientRecord[]; layer: GradLayer }) {
  if (gradHistory.length < 2) return <div style={{ width: 120, height: 28 }}/>;
  const vals = gradHistory.map(g => g.gradNorms[layer]);
  const max  = Math.max(...vals, 1e-9);
  const W = 120, H = 28, pl = 2, pr = 2, pt = 3, pb = 3;
  const iW = W - pl - pr, iH = H - pt - pb;
  const pts = vals.map((v, i) =>
    `${(pl + (i / (vals.length - 1)) * iW).toFixed(1)},${(pt + (1 - v / max) * iH).toFixed(1)}`
  ).join(' ');
  const lx = pl + iW, ly = pt + (1 - vals[vals.length - 1] / max) * iH;
  const color = LAYER_COLORS[layer];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 120, height: 28, overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.2} strokeLinejoin="round" opacity={0.8}/>
      <circle cx={lx} cy={ly} r={2} fill={color}/>
    </svg>
  );
}

// ─── Heatmap of grad norms over epochs ───────────────────────────────────────

function GradHeatmap({ gradHistory }: { gradHistory: GradientRecord[] }) {
  if (gradHistory.length < 2) return null;
  const recent = gradHistory.slice(-40);
  const allVals = GRAD_LAYERS.flatMap(l => recent.map(g => g.gradNorms[l]));
  const maxV = Math.max(...allVals, 1e-9);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {GRAD_LAYERS.map(layer => (
          <div key={layer} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 44, fontSize: 8, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{layer}</span>
            <div style={{ display: 'flex', gap: 0 }}>
              {recent.map((g, i) => {
                const v = g.gradNorms[layer] / maxV;
                const color = LAYER_COLORS[layer];
                // Parse color to r,g,b
                const hex = color.replace('#','');
                const r = parseInt(hex.slice(0,2),16), gC = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
                const bg = `rgba(${r},${gC},${b},${Math.max(0.05, v * 0.9)})`;
                return <div key={i} style={{ width: 6, height: 10, background: bg }}/>;
              })}
            </div>
            <span style={{ fontSize: 7, color: LAYER_COLORS[layer], marginLeft: 3, fontVariantNumeric: 'tabular-nums' }}>
              {gradHistory[gradHistory.length-1].gradNorms[layer].toFixed(4)}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 44 }}/>
          <div style={{ fontSize: 7, color: '#334155' }}>
            epochs {gradHistory[Math.max(0, gradHistory.length - 40)].epoch}–{gradHistory[gradHistory.length-1].epoch}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

type SubView = 'flow' | 'history' | 'updates';

interface Props {
  currentGrad: GradientRecord | null;
  gradHistory: GradientRecord[];
  history: EpochRecord[];
}

export default function BackpropPanel({ currentGrad, gradHistory }: Props) {
  const [view, setView] = useState<SubView>('flow');

  if (!currentGrad) {
    return (
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p className="card-title" style={{ margin: 0 }}>Backpropagation</p>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          Press ▶ Train to see gradient flow
        </div>
      </div>
    );
  }

  const ratio = currentGrad.gradNorms.conv1 / (currentGrad.gradNorms.output || 1e-9);

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <p className="card-title" style={{ margin: 0 }}>Backpropagation</p>
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface2)', borderRadius: 7, padding: 3 }}>
          {(['flow', 'history', 'updates'] as SubView[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '3px 9px', borderRadius: 5, border: 'none',
              background: view === v ? '#6366f1' : 'transparent',
              color: view === v ? '#fff' : 'var(--text-muted)',
              fontSize: 10, cursor: 'pointer', fontWeight: 600,
            }}>
              {v === 'flow' ? 'Grad Flow' : v === 'history' ? 'Heatmap' : 'Δ Weights'}
            </button>
          ))}
        </div>
      </div>

      {/* Status badges */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{
          fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 700,
          background: currentGrad.vanishing ? 'rgba(244,63,94,0.15)' : 'rgba(34,197,94,0.12)',
          color: currentGrad.vanishing ? '#f43f5e' : '#22c55e',
        }}>
          {currentGrad.vanishing ? '⚠ Vanishing' : '✓ Healthy'}
        </span>
        <span style={{
          fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 700,
          background: currentGrad.exploding ? 'rgba(244,63,94,0.15)' : 'rgba(99,102,241,0.12)',
          color: currentGrad.exploding ? '#f43f5e' : '#6366f1',
        }}>
          {currentGrad.exploding ? '⚠ Exploding' : 'Stable norms'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)' }}>epoch {currentGrad.epoch}</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {view === 'flow' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              L2 gradient norm per layer (output → input) &nbsp;·&nbsp; Δw = weight update magnitude
            </div>
            <GradFlowBar record={currentGrad}/>
            <div style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: '#22d3ee' }}>conv1</strong> receives{' '}
              <strong style={{ color: '#f59e0b' }}>{(ratio * 100).toFixed(1)}%</strong> of the output gradient
              {ratio < 0.05
                ? ' — early layers are undertraining (consider residual connections)'
                : ratio < 0.2
                  ? ' — mild depth attenuation, normal for deep nets'
                  : ' — gradient signal propagating well through all layers'}
            </div>
          </div>
        )}

        {view === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              Gradient norm over time — brighter = higher gradient magnitude
            </div>
            <GradHeatmap gradHistory={gradHistory}/>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
              Per-layer sparklines (last {gradHistory.length} epochs):
            </div>
            {GRAD_LAYERS.map(l => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 44, fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{l}</span>
                <GradSparkline gradHistory={gradHistory} layer={l}/>
                <span style={{ fontSize: 8, color: LAYER_COLORS[l], fontVariantNumeric: 'tabular-nums' }}>
                  {currentGrad.gradNorms[l].toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        )}

        {view === 'updates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              Effective weight update per layer = lr × ‖∇W‖
            </div>
            {GRAD_LAYERS.map(l => {
              const upd = currentGrad.weightUpd[l];
              const maxUpd = Math.max(...GRAD_LAYERS.map(x => currentGrad.weightUpd[x]));
              const pct = (upd / (maxUpd || 1e-9)) * 100;
              return (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 44, fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{l}</span>
                  <div style={{ flex: 1, height: 10, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: LAYER_COLORS[l], opacity: 0.85, transition: 'width 0.3s' }}/>
                  </div>
                  <span style={{ width: 60, fontSize: 8, color: LAYER_COLORS[l], fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0 }}>
                    {upd < 0.0001 ? upd.toExponential(2) : upd.toFixed(5)}
                  </span>
                </div>
              );
            })}
            <div style={{ marginTop: 4, padding: '6px 10px', borderRadius: 6, background: 'var(--surface2)', fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Update ratio (output ÷ conv1):{' '}
              <strong style={{ color: '#f59e0b' }}>
                {(currentGrad.weightUpd.output / (currentGrad.weightUpd.conv1 || 1e-9)).toFixed(1)}×
              </strong>
              {' '}— higher = earlier layers receive weaker parameter updates
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
