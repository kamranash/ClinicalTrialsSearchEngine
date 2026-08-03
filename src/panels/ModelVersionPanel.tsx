import { useState, useEffect, useCallback } from 'react';
import { listModelVersions, deleteModelVersion, updateModelNotes } from '../services/modelRegistry';
import type { ModelVersion } from '../services/modelRegistry';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function Pill({ label, val, color = '#6366f1' }: { label: string; val: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 8px', background: color + '12', borderRadius: 6, border: `1px solid ${color}30` }}>
      <span style={{ fontSize: 11, fontWeight: 800, color }}>{val}</span>
      <span style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>{label}</span>
    </div>
  );
}

function MetricsRow({ m }: { m: ModelVersion['metrics'] }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      <Pill label="val acc"  val={`${(m.finalValAcc  * 100).toFixed(1)}%`} color="#22c55e"/>
      <Pill label="val loss" val={m.finalValLoss.toFixed(3)}              color="#f43f5e"/>
      <Pill label="acc"      val={`${(m.finalAcc     * 100).toFixed(1)}%`} color="#6366f1"/>
      <Pill label="loss"     val={m.finalLoss.toFixed(3)}                  color="#f59e0b"/>
      <Pill label="epoch"    val={m.epoch}                                  color="#22d3ee"/>
      <Pill label="lr"       val={m.lr.toExponential(1)}                    color="#a78bfa"/>
    </div>
  );
}

// ── Version card ──────────────────────────────────────────────────────────────

function VersionCard({
  v, onDelete, onRestore, onNotesChange,
}: {
  v: ModelVersion;
  onDelete: () => void;
  onRestore: () => void;
  onNotesChange: (notes: string) => void;
}) {
  const [open,    setOpen]    = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(v.notes);
  const [saving,  setSaving]  = useState(false);
  const [deleting,setDeleting]= useState(false);

  const saveNotes = async () => {
    setSaving(true);
    try {
      await updateModelNotes(v.id, draft);
      onNotesChange(draft);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${v.tag}? This cannot be undone.`)) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  };

  const cfg = v.config;

  return (
    <div style={{
      background: 'var(--surface2)', borderRadius: 10,
      border: `1px solid ${open ? '#6366f150' : 'var(--border)'}`,
      overflow: 'hidden', transition: 'border-color 0.2s',
    }}>
      {/* Header row */}
      <div style={{ padding: '9px 11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        onClick={() => setOpen(o => !o)}>

        {/* Tag */}
        <span style={{
          fontSize: 12, fontWeight: 800, color: '#6366f1', flexShrink: 0,
          background: '#6366f112', border: '1px solid #6366f130',
          padding: '2px 8px', borderRadius: 6,
        }}>{v.tag}</span>

        {/* Metrics mini */}
        <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>
          {(v.metrics.finalValAcc * 100).toFixed(1)}% val acc
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          ep {v.metrics.epoch}
        </span>

        {/* Date */}
        <span style={{ fontSize: 9, color: '#475569', marginLeft: 'auto', flexShrink: 0 }}>{fmt(v.createdAt)}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Notes preview when closed */}
      {!open && v.notes && (
        <div style={{ padding: '0 11px 8px', fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {v.notes.slice(0, 80)}{v.notes.length > 80 ? '…' : ''}
        </div>
      )}

      {/* Expanded */}
      {open && (
        <div style={{ borderTop: '1px solid #6366f120', padding: '10px 11px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Metrics */}
          <MetricsRow m={v.metrics}/>

          {/* Config summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            {[
              ['Optimizer', cfg.optimizer],
              ['Scheduler', cfg.scheduler],
              ['LR',        cfg.lr.toExponential(1)],
              ['Batch',     String(cfg.batchSize)],
              ['Dropout',   String(cfg.dropout)],
              ['WD',        cfg.wd.toExponential(1)],
              ['Momentum',  String(cfg.momentum)],
              ['MaxEpochs', String(cfg.maxEpochs)],
              ['Dataset',   v.datasetSize ? `${v.datasetSize} trials` : 'simulation'],
            ].map(([k, val]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '2px 0' }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text)' }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Notes editor */}
          <div>
            <div style={{ fontSize: 9, color: '#a78bfa', fontWeight: 700, marginBottom: 4 }}>Notes</div>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: 10,
                    background: 'var(--surface2)', border: '1px solid #6366f150',
                    color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={saveNotes} disabled={saving} style={{
                    padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                    background: '#6366f1', color: '#fff', fontSize: 9, fontWeight: 700,
                  }}>{saving ? 'Saving…' : 'Save'}</button>
                  <button onClick={() => { setEditing(false); setDraft(v.notes); }} style={{
                    padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-muted)', fontSize: 9, cursor: 'pointer',
                  }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'text', minHeight: 18 }}
                onClick={() => setEditing(true)}>
                {v.notes || <em style={{ color: '#334155' }}>Click to add notes…</em>}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onRestore} style={{
              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: '#22c55e', color: '#fff', fontSize: 10, fontWeight: 700,
            }}>↩ Restore Config</button>
            <button onClick={() => setEditing(true)} style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer',
            }}>✎ Edit Notes</button>
            <button onClick={handleDelete} disabled={deleting} style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(244,63,94,0.35)',
              background: 'rgba(244,63,94,0.08)', color: '#f43f5e',
              fontSize: 10, cursor: 'pointer', marginLeft: 'auto',
            }}>{deleting ? '…' : '🗑 Delete'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  onRestoreConfig: (cfg: import('../hooks/useTraining').TrainingConfig) => void;
  refreshTrigger: number; // bump this to force a reload
}

export default function ModelVersionPanel({ onRestoreConfig, refreshTrigger }: Props) {
  const [versions, setVersions]   = useState<ModelVersion[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listModelVersions();
      setVersions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const handleDelete = async (id: string) => {
    await deleteModelVersion(id);
    setVersions(vs => vs.filter(v => v.id !== id));
  };

  const handleNotesChange = (id: string, notes: string) => {
    setVersions(vs => vs.map(v => v.id === id ? { ...v, notes } : v));
  };

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <p className="card-title" style={{ margin: 0 }}>Model Versions</p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {versions.length > 0 && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              {versions.length} saved
            </span>
          )}
          <button onClick={load} disabled={loading} title="Refresh" style={{
            width: 24, height: 24, borderRadius: 5, border: 'none', cursor: 'pointer',
            background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: 12,
          }}>{loading ? '…' : '↺'}</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 7, minHeight: 0 }}>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 42, borderRadius: 8, background: 'var(--surface2)', opacity: 0.5, animation: 'shimmer 1s infinite' }}/>
            ))}
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.3)', fontSize: 10, color: '#f43f5e' }}>
            ⚠ {error}
            {error.toLowerCase().includes('fetch') && (
              <div style={{ fontSize: 9, marginTop: 3, opacity: 0.8 }}>
                Start the backend: <code style={{ fontFamily: 'monospace' }}>docker compose up</code> or <code style={{ fontFamily: 'monospace' }}>node server/index.js</code>
              </div>
            )}
          </div>
        )}

        {!loading && !error && versions.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', padding: 20 }}>
            <div style={{ fontSize: 28 }}>🏷️</div>
            <div style={{ fontSize: 12, textAlign: 'center' }}>No saved versions yet</div>
            <div style={{ fontSize: 10, textAlign: 'center', maxWidth: 180, color: '#475569' }}>
              Train the model, then click <strong style={{ color: '#6366f1' }}>💾 Save Version</strong> in the header to checkpoint it.
            </div>
          </div>
        )}

        {!loading && !error && versions.map(v => (
          <VersionCard
            key={v.id}
            v={v}
            onDelete={() => handleDelete(v.id)}
            onRestore={() => onRestoreConfig(v.config)}
            onNotesChange={notes => handleNotesChange(v.id, notes)}
          />
        ))}
      </div>
      <style>{`@keyframes shimmer{0%,100%{opacity:.3}50%{opacity:.6}}`}</style>
    </div>
  );
}
