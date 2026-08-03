import { useState } from 'react';
import type { DatasetStats, CTPhase, CTStudy } from '../services/clinicalTrialsAPI';
import { FEATURE_NAMES } from '../services/clinicalTrialsAPI';
import type { FetchStatus } from '../hooks/useClinicalTrials';

const PHASE_COLORS: Record<CTPhase, string> = {
  PHASE1: '#6366f1', PHASE2: '#22d3ee', PHASE3: '#22c55e', PHASE4: '#a78bfa',
  NA: '#64748b',
};
const PHASE_LABELS: Record<CTPhase, string> = {
  PHASE1: 'Phase I', PHASE2: 'Phase II', PHASE3: 'Phase III', PHASE4: 'Phase IV',
  NA: 'N/A',
};

type SubView = 'overview' | 'studies' | 'features' | 'splits';

interface Props {
  fetchStatus: FetchStatus;
  progress: string;
  progressPct: number;
  dataset: DatasetStats | null;
  error: string | null;
  onFetch: () => void;
  epoch: number;
}

function StudyRow({ s, i }: { s: CTStudy; i: number }) {
  const [open, setOpen] = useState(false);
  const color = PHASE_COLORS[s.primaryPhase];
  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 5, marginBottom: 5 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <span style={{ width: 16, fontSize: 8, color: 'var(--text-muted)', flexShrink: 0, paddingTop: 1 }}>{i + 1}.</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{s.briefTitle}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 8, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{s.nctId}</span>
            <span style={{ fontSize: 8, padding: '0 4px', borderRadius: 3, background: color + '20', color }}>
              {PHASE_LABELS[s.primaryPhase]}
            </span>
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{s.overallStatus.replace(/_/g, ' ')}</span>
            {s.enrollmentCount > 0 && (
              <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>n={s.enrollmentCount.toLocaleString()}</span>
            )}
          </div>
        </div>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 5, marginLeft: 22, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[
            ['Sponsor', s.sponsorClass],
            ['Type', s.studyType],
            ['Allocation', s.allocation || '—'],
            ['Masking', s.masking || '—'],
            ['Purpose', s.primaryPurpose || '—'],
            ['Interventions', s.interventionTypes.join(', ') || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{
              background: 'var(--surface)', borderRadius: 4, padding: '2px 6px',
              border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 7, color: 'var(--text-muted)' }}>{k}: </span>
              <span style={{ fontSize: 7, color: 'var(--text)', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeatureImportanceBar({ name, idx, dataset }: { name: string; idx: number; dataset: DatasetStats }) {
  // Compute variance of this feature across all samples as a proxy for importance
  const vals = dataset.features.map(f => f.features[idx]);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  const importance = Math.min(1, variance * 4); // scale for visual
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
      <span style={{ width: 110, fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{name}</span>
      <div style={{ flex: 1, height: 8, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${importance * 100}%`, height: '100%', background: '#6366f1', opacity: 0.8, borderRadius: 2 }}/>
      </div>
      <span style={{ width: 30, fontSize: 8, color: '#6366f1', fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0 }}>
        {variance.toFixed(3)}
      </span>
    </div>
  );
}

export default function DatasetPanel({ fetchStatus, progress, progressPct, dataset, error, onFetch, epoch }: Props) {
  const [view, setView] = useState<SubView>('overview');
  const [studySearch, setStudySearch] = useState('');

  const filteredStudies = dataset?.studies.filter(s =>
    studySearch.length < 2 || s.briefTitle.toLowerCase().includes(studySearch.toLowerCase()) ||
    s.nctId.toLowerCase().includes(studySearch.toLowerCase())
  ) ?? [];

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <p className="card-title" style={{ margin: 0 }}>Training Data</p>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {dataset && (
            <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 700 }}>
              {dataset.total} trials loaded
            </span>
          )}
          <button onClick={onFetch} disabled={fetchStatus === 'fetching'} style={{
            padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 10, color: '#fff',
            background: fetchStatus === 'fetching' ? 'var(--surface2)' : '#22d3ee',
            opacity: fetchStatus === 'fetching' ? 0.6 : 1,
          }}>
            {fetchStatus === 'fetching' ? '⟳ Fetching…' : fetchStatus === 'done' ? '↺ Refresh' : '⬇ Fetch from CT.gov'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {fetchStatus === 'fetching' && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: '#22d3ee', marginBottom: 4 }}>{progress}</div>
          <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(to right,#6366f1,#22d3ee)', borderRadius: 2, transition: 'width 0.3s' }}/>
          </div>
        </div>
      )}

      {/* Error state */}
      {fetchStatus === 'error' && (
        <div style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(244,63,94,0.12)', border: '1px solid #f43f5e40', fontSize: 10, color: '#f43f5e', flexShrink: 0 }}>
          ⚠ {error}. Check that the dev server is running with Vite proxy enabled.
        </div>
      )}

      {/* Idle/not fetched yet */}
      {fetchStatus === 'idle' && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 10, color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: 28 }}>🔬</div>
          <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 200 }}>
            Fetch real clinical trial data from <strong style={{ color: '#22d3ee' }}>ClinicalTrials.gov</strong>
          </div>
          <div style={{ fontSize: 10, color: '#475569', textAlign: 'center', maxWidth: 200 }}>
            ~300 studies · Phase I–IV · All therapeutic areas<br/>
            16 engineered features for phase classification
          </div>
          <button onClick={onFetch} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#6366f1,#22d3ee)', color: '#fff',
            fontWeight: 700, fontSize: 12,
          }}>
            ⬇ Fetch Data
          </button>
        </div>
      )}

      {/* Loaded — show sub-views */}
      {dataset && fetchStatus === 'done' && (
        <>
          {/* Sub-nav */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface2)', borderRadius: 7, padding: 3, flexShrink: 0 }}>
            {(['overview','studies','features','splits'] as SubView[]).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                flex: 1, padding: '3px 0', borderRadius: 5, border: 'none',
                background: view === v ? '#6366f1' : 'transparent',
                color: view === v ? '#fff' : 'var(--text-muted)',
                fontSize: 9, cursor: 'pointer', fontWeight: 600,
              }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>

            {/* ── Overview ─────────────── */}
            {view === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Source: <strong style={{ color: '#22d3ee' }}>ClinicalTrials.gov v2 API</strong> &nbsp;·&nbsp;
                  Fetched {new Date().toLocaleDateString()}
                </div>
                {/* Phase distribution */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Phase distribution</div>
                  {(['PHASE1','PHASE2','PHASE3','PHASE4','NA'] as CTPhase[]).map(p => {
                    const count = dataset.byPhase[p] ?? 0;
                    const pct = (count / dataset.total) * 100;
                    return (
                      <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 55, fontSize: 9, color: PHASE_COLORS[p], fontWeight: 700, flexShrink: 0 }}>
                          {PHASE_LABELS[p]}
                        </span>
                        <div style={{ flex: 1, height: 10, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: PHASE_COLORS[p], opacity: 0.8 }}/>
                        </div>
                        <span style={{ width: 32, fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{count}</span>
                        <span style={{ width: 32, fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
                {/* Stats grid */}
                {[
                  ['Total studies', dataset.total.toLocaleString()],
                  ['Features', String(FEATURE_NAMES.length)],
                  ['Train split', Math.round(dataset.total * 0.8).toLocaleString()],
                  ['Val split', Math.round(dataset.total * 0.1).toLocaleString()],
                  ['Test split', Math.round(dataset.total * 0.1).toLocaleString()],
                  ['Task', 'Phase I–IV classification'],
                  ['Baseline acc.', '25% (random)'],
                  ['Target acc.', '~82–88%'],
                  ['Epoch', String(epoch)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{k}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text)' }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Studies browser ───────── */}
            {view === 'studies' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  placeholder="Search by title or NCT ID…"
                  value={studySearch}
                  onChange={e => setStudySearch(e.target.value)}
                  style={{
                    width: '100%', padding: '5px 8px', borderRadius: 6,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    color: 'var(--text)', fontSize: 10,
                  }}
                />
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                  {filteredStudies.length} of {dataset.total} studies — click row to expand
                </div>
                {filteredStudies.slice(0, 50).map((s, i) => (
                  <StudyRow key={s.nctId} s={s} i={i}/>
                ))}
                {filteredStudies.length > 50 && (
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>
                    Showing first 50 — use search to filter
                  </div>
                )}
              </div>
            )}

            {/* ── Feature importances ───── */}
            {view === 'features' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Feature variance across {dataset.total} studies — higher = more discriminative for phase classification
                </div>
                {FEATURE_NAMES.map((name, i) => (
                  <FeatureImportanceBar key={name} name={name} idx={i} dataset={dataset}/>
                ))}
              </div>
            )}

            {/* ── Splits ─────────────────── */}
            {view === 'splits' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>80 / 10 / 10 stratified split by phase</div>
                {/* Stacked bar */}
                <div style={{ display: 'flex', height: 16, borderRadius: 6, overflow: 'hidden' }}>
                  {[['Train','#6366f1',80],['Val','#22d3ee',10],['Test','#a78bfa',10]] .map(([l,c,p]) => (
                    <div key={l as string} style={{ width: `${p}%`, background: c as string, opacity: 0.8 }}/>
                  ))}
                </div>
                {[
                  { label: 'Train', color: '#6366f1', pct: 80, desc: 'Used for gradient updates each epoch. Shuffled per epoch.' },
                  { label: 'Val',   color: '#22d3ee', pct: 10, desc: 'Used for early stopping and loss monitoring. No augmentation.' },
                  { label: 'Test',  color: '#a78bfa', pct: 10, desc: 'Held out. Evaluated only after training completes.' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--surface2)', borderRadius: 7, padding: '7px 10px', border: `1px solid ${s.color}25` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {Math.round(dataset.total * s.pct / 100).toLocaleString()} studies ({s.pct}%)
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.desc}</div>
                  </div>
                ))}
                <div style={{ background: 'var(--surface2)', borderRadius: 7, padding: '8px 10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, color: '#6366f1', fontWeight: 700, marginBottom: 3 }}>Feature engineering pipeline</div>
                  <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'monospace', lineHeight: 1.7 }}>
                    fetch_ct_api(query) → parse_protocol_section()<br/>
                    → extract_16_features() → normalize([0,1])<br/>
                    → stratified_split(0.8, 0.1, 0.1)<br/>
                    → DataLoader(batch={'{batchSize}'})
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
