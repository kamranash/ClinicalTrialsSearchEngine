import { useState, useCallback } from 'react';
import './index.css';
import { useTraining } from './hooks/useTraining';
import { useClinicalTrials } from './hooks/useClinicalTrials';
import { saveModelVersion } from './services/modelRegistry';
import MetricsPanel      from './panels/MetricsPanel';
import ArchitecturePanel  from './panels/ArchitecturePanel';
import ActivationsPanel   from './panels/ActivationsPanel';
import HyperParamPanel    from './panels/HyperParamPanel';
import InferencePanel     from './panels/InferencePanel';
import BackpropPanel      from './panels/BackpropPanel';
import DatasetPanel       from './panels/DatasetPanel';
import TrialSearchPanel   from './panels/TrialSearchPanel';
import ModelVersionPanel  from './panels/ModelVersionPanel';

const STATUS_COLOR = { idle: '#64748b', running: '#22c55e', paused: '#f59e0b', done: '#6366f1' };
const STATUS_LABEL = { idle: 'Ready', running: 'Training', paused: 'Paused', done: 'Complete' };

// Bottom-center panel tabs
type BotCenterTab = 'activations' | 'backprop';
// Bottom-right panel tabs
type BotRightTab  = 'inference' | 'dataset' | 'versions';

export default function App() {
  const training = useTraining();
  const ctData = useClinicalTrials();
  const { status, history, gradHistory, currentGrad, current, config, speed, setSpeed, start, pause, reset, retrain } = training;

  const [selectedLayer, setSelectedLayer] = useState('conv1');
  const [botCenter, setBotCenter] = useState<BotCenterTab>('backprop');
  const [botRight,  setBotRight]  = useState<BotRightTab>('dataset');
  const [showFinder, setShowFinder] = useState(false);

  // ── Model versioning ─────────────────────────────────────────────────────
  const [saveOpen,   setSaveOpen]   = useState(false);
  const [saveTag,    setSaveTag]    = useState('');
  const [saveNotes,  setSaveNotes]  = useState('');
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [saveOk,     setSaveOk]     = useState<string | null>(null);  // last saved tag toast
  const [versionRefresh, setVersionRefresh] = useState(0);

  const openSaveDialog = useCallback(() => {
    setSaveTag('');
    setSaveNotes('');
    setSaveError(null);
    setSaveOk(null);
    setSaveOpen(true);
  }, []);

  const doSave = useCallback(async () => {
    const last = history[history.length - 1];
    if (!last) { setSaveError('No training data yet — run at least one epoch'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveModelVersion(
        saveTag, saveNotes, config, last,
        ctData.dataset?.total ?? null
      );
      setSaveOk(saved.tag);
      setVersionRefresh(n => n + 1);
      setSaveOpen(false);
      setBotRight('versions');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [history, saveTag, saveNotes, config, ctData.dataset]);

  const epoch    = current?.epoch ?? 0;
  const sColor   = STATUS_COLOR[status];
  const sLabel   = STATUS_LABEL[status];
  const progress = Math.round((epoch / config.maxEpochs) * 100);

  return (
    <div style={{ height: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '0 16px', display: 'flex', alignItems: 'center', gap: 14, height: 52, flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
            {[7,13,19].map(y => <circle key={y} cx={4} cy={y} r={2.4} fill="#6366f1"/>)}
            {[4,10,16,22].map(y => <circle key={y} cx={13} cy={y} r={2.4} fill="#22d3ee"/>)}
            {[7,13,19].map(y => <circle key={y} cx={22} cy={y} r={2.4} fill="#a78bfa"/>)}
            {[7,13,19].flatMap(y1 => [4,10,16,22].map(y2 =>
              <line key={`a${y1}-${y2}`} x1="6.4" y1={y1} x2="10.6" y2={y2} stroke="#252944" strokeWidth="0.7"/>
            ))}
            {[4,10,16,22].flatMap(y1 => [7,13,19].map(y2 =>
              <line key={`b${y1}-${y2}`} x1="15.4" y1={y1} x2="19.6" y2={y2} stroke="#252944" strokeWidth="0.7"/>
            ))}
          </svg>
          <span style={{ fontWeight: 800, fontSize: 15 }}>DNN <span style={{ color: '#6366f1' }}>Dashboard</span></span>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: sColor, display: 'inline-block',
            boxShadow: status === 'running' ? `0 0 7px ${sColor}` : 'none',
            animation: status === 'running' ? 'pulse 1.5s infinite' : 'none',
          }}/>
          <span style={{ fontSize: 12, color: sColor, fontWeight: 600 }}>{sLabel}</span>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 120, height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#6366f1', transition: 'width 0.12s linear', borderRadius: 2 }}/>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {epoch}<span style={{ color: 'var(--border)' }}>/</span>{config.maxEpochs}
          </span>
        </div>

        {/* Config badges */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
          {[config.optimizer, config.scheduler, `lr=${config.lr.toExponential(1)}`].map(t => (
            <span key={t} style={{ background: 'var(--surface2)', borderRadius: 4, padding: '2px 6px' }}>{t}</span>
          ))}
          {ctData.fetchStatus === 'done' && ctData.dataset && (
            <span style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>
              {ctData.dataset.total} trials from CT.gov
            </span>
          )}
          {ctData.fetchStatus === 'fetching' && (
            <span style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee', borderRadius: 4, padding: '2px 6px' }}>
              ⟳ {ctData.progress}
            </span>
          )}
        </div>

        {/* Controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Speed</span>
          {[1, 2, 5, 10].map(s => (
            <button key={s} onClick={() => setSpeed(s)} style={{
              padding: '3px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11,
              background: speed === s ? '#6366f1' : 'var(--surface2)',
              color: speed === s ? '#fff' : 'var(--text-muted)',
            }}>{s}×</button>
          ))}
          <button onClick={status === 'running' ? pause : start} style={{
            padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
            background: status === 'running' ? '#f43f5e' : '#22c55e', color: '#fff', marginLeft: 4,
          }}>
            {status === 'running' ? '⏸ Pause' : status === 'done' ? '↺ Restart' : '▶ Train'}
          </button>
          <button onClick={reset} title="Reset" style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: 15,
          }}>↺</button>
          <a href="/search" style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 12, color: '#fff', marginLeft: 4, textDecoration: 'none',
            background: 'linear-gradient(135deg,#6366f1,#22d3ee)', display: 'inline-block',
          }}>🔬 Find Trials</a>
          <button onClick={() => setShowFinder(true)} title="Quick search overlay" style={{
            padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface2)',
          }}>⊞</button>
          <button onClick={openSaveDialog} disabled={history.length === 0} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 12, color: '#fff', marginLeft: 2,
            background: history.length === 0 ? 'var(--surface2)' : 'linear-gradient(135deg,#a78bfa,#6366f1)',
            opacity: history.length === 0 ? 0.5 : 1,
          }}>💾 Save Version</button>
          {saveOk && (
            <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, animation: 'fadeIn 0.3s' }}>
              ✓ {saveOk} saved
            </span>
          )}
        </div>
      </header>

      {/* ── Main grid ────────────────────────────────────────── */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: '290px 1fr 300px',
        gridTemplateRows: '1fr 1fr',
        gridTemplateAreas: `"arch metrics hyper" "arch bot-center bot-right"`,
        gap: 10, padding: 10, overflow: 'hidden', minHeight: 0,
      }}>
        {/* Architecture — full left column */}
        <div style={{ gridArea: 'arch', minHeight: 0, overflow: 'hidden' }}>
          <ArchitecturePanel selectedLayer={selectedLayer} onSelectLayer={setSelectedLayer}/>
        </div>

        {/* Metrics — top center */}
        <div style={{ gridArea: 'metrics', minHeight: 0, overflow: 'auto' }}>
          <MetricsPanel history={history} status={status} maxEpochs={config.maxEpochs}/>
        </div>

        {/* Hyperparams — top right */}
        <div style={{ gridArea: 'hyper', minHeight: 0, overflow: 'auto' }}>
          <HyperParamPanel config={config} onRetrain={retrain}/>
        </div>

        {/* Bottom center: Activations ↔ Backprop */}
        <div style={{ gridArea: 'bot-center', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Tab strip */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 6, flexShrink: 0 }}>
            {([
              { id: 'backprop',    label: 'Backprop ∇', badge: currentGrad ? (currentGrad.vanishing ? '⚠' : '✓') : null, badgeColor: currentGrad?.vanishing ? '#f43f5e' : '#22c55e' },
              { id: 'activations', label: 'Activations', badge: null, badgeColor: '' },
            ] as { id: BotCenterTab; label: string; badge: string | null; badgeColor: string }[]).map(t => (
              <button key={t.id} onClick={() => setBotCenter(t.id)} style={{
                padding: '4px 12px', borderRadius: 7,
                border: botCenter === t.id ? '1px solid var(--border)' : '1px solid transparent',
                cursor: 'pointer', fontWeight: 700, fontSize: 11,
                background: botCenter === t.id ? 'var(--surface)' : 'transparent',
                color: botCenter === t.id ? '#6366f1' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {t.label}
                {t.badge && <span style={{ fontSize: 9, color: t.badgeColor }}>{t.badge}</span>}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {botCenter === 'backprop'
              ? <BackpropPanel currentGrad={currentGrad} gradHistory={gradHistory} history={history}/>
              : <ActivationsPanel selectedLayer={selectedLayer} epoch={epoch}/>
            }
          </div>
        </div>

        {/* Bottom right: Inference ↔ Dataset */}
        <div style={{ gridArea: 'bot-right', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Tab strip */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 6, flexShrink: 0 }}>
            {([
              { id: 'dataset',   label: 'Training Data' },
              { id: 'inference', label: 'Inference' },
              { id: 'versions',  label: `Versions${saveOk ? ' •' : ''}` },
            ] as { id: BotRightTab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setBotRight(t.id)} style={{
                padding: '4px 12px', borderRadius: 7,
                border: botRight === t.id ? '1px solid var(--border)' : '1px solid transparent',
                cursor: 'pointer', fontWeight: 700, fontSize: 11,
                background: botRight === t.id ? 'var(--surface)' : 'transparent',
                color: botRight === t.id ? '#6366f1' : 'var(--text-muted)',
              }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {botRight === 'dataset'
              ? <DatasetPanel
                  fetchStatus={ctData.fetchStatus}
                  progress={ctData.progress}
                  progressPct={ctData.progressPct}
                  dataset={ctData.dataset}
                  error={ctData.error}
                  onFetch={ctData.fetchData}
                  epoch={epoch}
                />
              : botRight === 'inference'
              ? <InferencePanel/>
              : <ModelVersionPanel
                  onRestoreConfig={retrain}
                  refreshTrigger={versionRefresh}
                />
            }
          </div>
        </div>
      </main>

      {showFinder && (
        <TrialSearchPanel
          onClose={() => setShowFinder(false)}
          localStudies={ctData.dataset?.studies ?? []}
        />
      )}

      {/* ── Save Version Dialog ── */}
      {saveOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) setSaveOpen(false); }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
            padding: '24px 28px', width: 380, display: 'flex', flexDirection: 'column', gap: 14,
            animation: 'slideIn 0.18s ease-out',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>💾 Save Model Version</div>

            {/* Current metrics snapshot */}
            {history.length > 0 && (() => {
              const last = history[history.length - 1];
              return (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'val acc',  val: `${(last.valAcc  * 100).toFixed(1)}%`, color: '#22c55e' },
                    { label: 'val loss', val: last.valLoss.toFixed(3),                color: '#f43f5e' },
                    { label: 'epoch',    val: String(last.epoch),                     color: '#22d3ee' },
                  ].map(p => (
                    <div key={p.label} style={{ textAlign: 'center', padding: '4px 10px', background: p.color + '12', borderRadius: 6, border: `1px solid ${p.color}30` }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: p.color }}>{p.val}</div>
                      <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>{p.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Tag input */}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Version tag <span style={{ color: '#475569' }}>(leave blank for auto)</span></div>
              <input
                value={saveTag}
                onChange={e => setSaveTag(e.target.value)}
                placeholder="e.g. v1.0, baseline, after-ct-data"
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 12,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>

            {/* Notes input */}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Notes</div>
              <textarea
                value={saveNotes}
                onChange={e => setSaveNotes(e.target.value)}
                rows={2}
                placeholder="Describe this run…"
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 12,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit',
                }}
              />
            </div>

            {saveError && (
              <div style={{ fontSize: 10, color: '#f43f5e', padding: '5px 8px', background: 'rgba(244,63,94,0.08)', borderRadius: 5 }}>⚠ {saveError}</div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setSaveOpen(false)} style={{
                padding: '7px 18px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
              }}>Cancel</button>
              <button onClick={doSave} disabled={saving} style={{
                padding: '7px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#a78bfa,#6366f1)', color: '#fff',
                fontWeight: 700, fontSize: 12, opacity: saving ? 0.7 : 1,
              }}>{saving ? 'Saving…' : '💾 Save'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes slideIn { from { transform: translateY(20px) scale(0.97); opacity:0 } to { transform: none; opacity:1 } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        button { font-family: inherit; }
      `}</style>
    </div>
  );
}
