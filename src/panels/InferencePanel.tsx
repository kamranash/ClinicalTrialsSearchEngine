import { useState, useCallback } from 'react';
import { inferenceSamples, PHASE_LABELS, PHASE_COLORS } from '../data/mockData';
import type { InferenceSample, CTPhase } from '../data/mockData';

function ProbBar({ cls, prob, max, active }: { cls: CTPhase; prob: number; max: number; active: boolean }) {
  const color = PHASE_COLORS[cls];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
      <span style={{ width: 60, fontSize: 9, textAlign: 'right', flexShrink: 0,
        color: active ? color : 'var(--text-muted)', fontWeight: active ? 700 : 400 }}>
        {PHASE_LABELS[cls]}
      </span>
      <div style={{ flex: 1, height: 10, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${(prob / max) * 100}%`, height: '100%', background: color,
          opacity: active ? 0.95 : 0.35, borderRadius: 2, transition: 'width 0.4s ease',
        }}/>
      </div>
      <span style={{ width: 38, fontSize: 9, color, fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0 }}>
        {(prob * 100).toFixed(1)}%
      </span>
    </div>
  );
}

function SampleCard({ s, selected, onClick }: { s: InferenceSample; selected: boolean; onClick: () => void }) {
  const trueColor = PHASE_COLORS[s.label];
  return (
    <button onClick={onClick} style={{
      background: selected ? `${trueColor}10` : 'var(--surface2)',
      border: `1px solid ${selected ? trueColor : 'var(--border)'}`,
      borderRadius: 7, padding: '6px 8px', cursor: 'pointer', textAlign: 'left', width: '100%',
    }}>
      <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 2, fontFamily: 'monospace' }}>{s.nctId}</div>
      <div style={{ fontSize: 9, color: s.correct ? '#22c55e' : '#f43f5e', fontWeight: 700 }}>
        {s.correct ? '✓' : '✗'} {PHASE_LABELS[s.predicted]}
      </div>
      <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>True: {PHASE_LABELS[s.label]}</div>
    </button>
  );
}

// Feature summary for a sample
function FeaturePills({ s }: { s: InferenceSample }) {
  const pills = [
    { label: 'Sponsor',    value: s.sponsorClass,     color: '#6366f1' },
    { label: 'n',          value: s.enrollment.toLocaleString(), color: '#22d3ee' },
    { label: 'Allocation', value: s.allocation,       color: '#f59e0b' },
    { label: 'Intervention',value: s.interventionType, color: '#22c55e' },
  ];
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', margin: '6px 0' }}>
      {pills.map(p => (
        <span key={p.label} style={{
          fontSize: 8, padding: '2px 6px', borderRadius: 4,
          background: p.color + '15', color: p.color, fontWeight: 600,
        }}>
          {p.label}: {p.value}
        </span>
      ))}
    </div>
  );
}

export default function InferencePanel() {
  const [selected, setSelected] = useState<InferenceSample>(inferenceSamples[0]);
  const [running,  setRunning]  = useState(false);
  const [show,     setShow]     = useState(true);

  const runInference = useCallback(() => {
    setRunning(true); setShow(false);
    setTimeout(() => { setRunning(false); setShow(true); }, 800);
  }, []);

  const maxProb = Math.max(...selected.probs.map(p => p.prob));
  const correct = selected.label === selected.predicted;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <p className="card-title" style={{ margin: 0 }}>Phase Prediction</p>
        <button onClick={runInference} disabled={running} style={{
          padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11,
          background: running ? 'var(--surface2)' : '#6366f1', color: '#fff', opacity: running ? 0.6 : 1,
        }}>
          {running ? '⟳ Running…' : '▶ Run'}
        </button>
      </div>

      {/* Sample grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, flexShrink: 0 }}>
        {inferenceSamples.map(s => (
          <SampleCard key={s.id} s={s} selected={selected.id === s.id}
            onClick={() => { setSelected(s); setShow(false); setTimeout(() => setShow(true), 80); }}/>
        ))}
      </div>

      {/* Detail pane */}
      <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px', border: '1px solid var(--border)', flex: 1 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
          {selected.nctId}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 4 }}>
          {selected.title}
        </div>
        <FeaturePills s={selected}/>

        {running ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {(['PHASE1','PHASE2','PHASE3','PHASE4'] as CTPhase[]).map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 60, fontSize: 9, textAlign: 'right', color: 'var(--text-muted)' }}>{PHASE_LABELS[p]}</span>
                <div style={{ flex: 1, height: 10, background: 'var(--border)', borderRadius: 2, animation: 'shimmer 1s infinite', opacity: 0.4 }}/>
              </div>
            ))}
          </div>
        ) : show && (
          <>
            <div style={{ marginBottom: 4 }}>
              {selected.probs.map(p => (
                <ProbBar key={p.cls} cls={p.cls} prob={p.prob} max={maxProb} active={p.cls === selected.predicted}/>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 6 }}>
              <span style={{
                display: 'inline-block', padding: '3px 14px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                background: correct ? 'rgba(34,197,94,0.15)' : 'rgba(244,63,94,0.15)',
                color: correct ? '#22c55e' : '#f43f5e',
              }}>
                {correct ? '✓ Correct' : `✗ Predicted ${PHASE_LABELS[selected.predicted]}, true ${PHASE_LABELS[selected.label]}`}
                &nbsp;·&nbsp;{(selected.probs[0].prob * 100).toFixed(1)}% conf
              </span>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes shimmer{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
    </div>
  );
}
