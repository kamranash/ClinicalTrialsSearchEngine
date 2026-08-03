import { useState, useEffect } from 'react';
import type { TrainingConfig } from '../hooks/useTraining';

const OPTIMIZERS = ['SGD', 'Adam', 'AdamW', 'RMSProp', 'Adagrad'];
const SCHEDULERS = ['None', 'StepLR', 'CosineAnnealing', 'ReduceOnPlateau', 'OneCycleLR'];

interface SliderDef {
  key: keyof TrainingConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}

const SLIDERS: SliderDef[] = [
  { key: 'lr',        label: 'Learning Rate', min: 0.00001, max: 0.1,   step: 0.00001, fmt: v => v.toExponential(2) },
  { key: 'batchSize', label: 'Batch Size',    min: 8,       max: 512,   step: 8,       fmt: v => String(v) },
  { key: 'dropout',   label: 'Dropout',       min: 0,       max: 0.9,   step: 0.05,    fmt: v => v.toFixed(2) },
  { key: 'wd',        label: 'Weight Decay',  min: 0,       max: 0.01,  step: 0.0001,  fmt: v => v.toExponential(2) },
  { key: 'momentum',  label: 'Momentum',      min: 0.5,     max: 0.999, step: 0.001,   fmt: v => v.toFixed(3) },
  { key: 'maxEpochs', label: 'Max Epochs',    min: 20,      max: 200,   step: 10,      fmt: v => String(v) },
];

// Rough estimate of convergence speed from config
function estimateEpochsToConverge(cfg: TrainingConfig): number {
  const optF  = { SGD: 1.5, Adam: 1.0, AdamW: 0.95, RMSProp: 1.1, Adagrad: 1.2 }[cfg.optimizer] ?? 1;
  const schF  = { None: 1.1, StepLR: 1.0, CosineAnnealing: 0.9, ReduceOnPlateau: 1.05, OneCycleLR: 0.85 }[cfg.scheduler] ?? 1;
  const base  = 40 / (cfg.lr / 0.001) / optF / schF;
  return Math.round(Math.min(cfg.maxEpochs, Math.max(10, base)));
}

interface Props {
  config: TrainingConfig;
  onRetrain: (cfg: TrainingConfig) => void;
}

export default function HyperParamPanel({ config, onRetrain }: Props) {
  const [local, setLocal] = useState<TrainingConfig>(config);
  const [dirty, setDirty] = useState(false);

  // Sync when parent config changes (e.g. reset)
  useEffect(() => { setLocal(config); setDirty(false); }, [config]);

  function upd<K extends keyof TrainingConfig>(key: K, val: TrainingConfig[K]) {
    setLocal(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  const est = estimateEpochsToConverge(local);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p className="card-title" style={{ margin: 0 }}>Hyperparameters</p>
        {dirty && (
          <span style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', borderRadius: 4, padding: '2px 6px' }}>
            unsaved
          </span>
        )}
      </div>

      {/* Optimizer / Scheduler */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Optimizer', key: 'optimizer' as const, opts: OPTIMIZERS },
          { label: 'Scheduler', key: 'scheduler' as const, opts: SCHEDULERS },
        ].map(({ label, key, opts }) => (
          <div key={key}>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>{label}</label>
            <select value={local[key] as string} onChange={e => upd(key, e.target.value)} style={{
              width: '100%', padding: '5px 6px', borderRadius: 6,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 11, cursor: 'pointer',
            }}>
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Sliders */}
      {SLIDERS.map(s => {
        const val = local[s.key] as number;
        const pct = ((val - s.min) / (s.max - s.min)) * 100;
        return (
          <div key={String(s.key)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <label style={{ fontSize: 11, color: 'var(--text)' }}>{s.label}</label>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', fontVariantNumeric: 'tabular-nums' }}>
                {s.fmt(val)}
              </span>
            </div>
            <div style={{ position: 'relative', height: 4, background: 'var(--surface2)', borderRadius: 2, marginBottom: 3 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#6366f1', borderRadius: 2 }}/>
            </div>
            <input type="range" min={s.min} max={s.max} step={s.step} value={val}
              onChange={e => upd(s.key, Number(e.target.value))}
              style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer', marginTop: -18, opacity: 0, height: 18 }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#334155' }}>
              <span>{s.fmt(s.min)}</span><span>{s.fmt(s.max)}</span>
            </div>
          </div>
        );
      })}

      {/* Convergence estimate */}
      <div style={{
        background: 'var(--surface2)', borderRadius: 7, padding: '7px 10px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Est. convergence:</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#22d3ee' }}>~{est} epochs</span>
      </div>

      {/* Retrain button */}
      <button onClick={() => { onRetrain(local); setDirty(false); }} style={{
        padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontWeight: 700, fontSize: 12, color: '#fff',
        background: dirty ? 'linear-gradient(135deg,#6366f1,#a78bfa)' : '#22c55e',
        transition: 'background 0.3s',
        boxShadow: dirty ? '0 0 12px rgba(99,102,241,0.4)' : 'none',
      }}>
        {dirty ? '⚡ Retrain with New Config' : '✓ Applied'}
      </button>
    </div>
  );
}
