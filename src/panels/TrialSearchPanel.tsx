import { useState, useCallback, useRef, useEffect } from 'react';
import { searchClinicalTrials } from '../services/clinicalTrialsAPI';
import type { CTStudy, CTPhase } from '../services/clinicalTrialsAPI';

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<CTPhase, string> = {
  PHASE1: 'Phase I', PHASE2: 'Phase II', PHASE3: 'Phase III', PHASE4: 'Phase IV',
  NA: 'N/A',
};
const PHASE_COLORS: Record<CTPhase, string> = {
  PHASE1: '#6366f1', PHASE2: '#22d3ee', PHASE3: '#22c55e', PHASE4: '#a78bfa',
  NA: '#64748b',
};

const ALL_PHASES: CTPhase[] = ['PHASE1', 'PHASE2', 'PHASE3', 'PHASE4'];

const STATUS_OPTIONS = [
  { label: 'Recruiting',           value: 'RECRUITING' },
  { label: 'Active, not recruiting', value: 'ACTIVE_NOT_RECRUITING' },
  { label: 'Completed',            value: 'COMPLETED' },
  { label: 'Not yet recruiting',   value: 'NOT_YET_RECRUITING' },
  { label: 'Enrolling by invitation', value: 'ENROLLING_BY_INVITATION' },
];

const SPONSOR_OPTIONS = [
  { label: 'Industry',    value: 'INDUSTRY' },
  { label: 'NIH',         value: 'NIH' },
  { label: 'U.S. Fed.',   value: 'FED' },
  { label: 'Other',       value: 'OTHER' },
];

const STATUS_COLORS: Record<string, string> = {
  RECRUITING:              '#22c55e',
  ACTIVE_NOT_RECRUITING:   '#f59e0b',
  COMPLETED:               '#6366f1',
  NOT_YET_RECRUITING:      '#22d3ee',
  ENROLLING_BY_INVITATION: '#a78bfa',
};

const PRESET_QUERIES = [
  'breast cancer immunotherapy',
  'type 2 diabetes GLP-1',
  'Alzheimer disease prevention',
  'lung cancer EGFR targeted therapy',
  'COVID-19 antiviral treatment',
  'multiple sclerosis relapse',
  'prostate cancer hormone therapy',
  'rheumatoid arthritis biologics',
];

// ── Helper components ─────────────────────────────────────────────────────────

function Chip({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 20, border: `1px solid ${active ? (color ?? '#6366f1') : 'var(--border)'}`,
      background: active ? (color ?? '#6366f1') + '22' : 'var(--surface2)',
      color: active ? (color ?? '#6366f1') : 'var(--text-muted)',
      fontSize: 11, cursor: 'pointer', fontWeight: active ? 700 : 400,
      transition: 'all 0.15s',
    }}>
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const color = STATUS_COLORS[status] ?? '#64748b';
  return (
    <span style={{
      fontSize: 9, padding: '1px 7px', borderRadius: 10,
      background: color + '18', color,
      border: `1px solid ${color}40`, fontWeight: 600, flexShrink: 0,
    }}>{label}</span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} title="Copy NCT ID" style={{
      padding: '2px 7px', borderRadius: 5, border: '1px solid var(--border)',
      background: 'var(--surface2)', color: copied ? '#22c55e' : 'var(--text-muted)',
      fontSize: 9, cursor: 'pointer',
    }}>
      {copied ? '✓ Copied' : 'Copy ID'}
    </button>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────

function TrialCard({ s, query }: { s: CTStudy; query: string }) {
  const [open, setOpen] = useState(false);
  const color = PHASE_COLORS[s.primaryPhase];
  const ctUrl = `https://clinicaltrials.gov/study/${s.nctId}`;

  // Highlight matching text in title
  const title = query.trim()
    ? s.briefTitle.replace(
        new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
        '<mark style="background:#6366f122;color:#a5b4fc;border-radius:2px">$1</mark>'
      )
    : s.briefTitle;

  return (
    <div style={{
      background: 'var(--surface2)', borderRadius: 10,
      border: `1px solid ${open ? color + '50' : 'var(--border)'}`,
      overflow: 'hidden', transition: 'border-color 0.2s', flexShrink: 0,
    }}>
      {/* Card header */}
      <div style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
          {/* Phase badge */}
          <span style={{
            fontSize: 9, padding: '2px 8px', borderRadius: 10, flexShrink: 0, marginTop: 1,
            background: color + '20', color, border: `1px solid ${color}40`, fontWeight: 700,
          }}>
            {PHASE_LABELS[s.primaryPhase]}
          </span>
          {/* Title */}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, flex: 1 }}
            dangerouslySetInnerHTML={{ __html: title }}/>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.nctId}</span>
          <StatusBadge status={s.overallStatus}/>
          {s.enrollmentCount > 0 && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              n={s.enrollmentCount.toLocaleString()}
            </span>
          )}
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {s.sponsorClass.charAt(0) + s.sponsorClass.slice(1).toLowerCase()}
          </span>
          {s.interventionTypes.slice(0,3).map((t, i) => (
            <span key={`${t}-${i}`} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--surface)', color: '#94a3b8', border: '1px solid var(--border)' }}>
              {t.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ borderTop: `1px solid ${color}25`, padding: '10px 12px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Attribute grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
            {[
              ['Study type',   s.studyType.replace(/_/g, ' ')],
              ['Allocation',   s.allocation || '—'],
              ['Masking',      s.masking || '—'],
              ['Purpose',      s.primaryPurpose?.replace(/_/g, ' ') || '—'],
              ['Arms',         String(s.numArms)],
              ['Conditions',   String(s.numConditions)],
              ['Has placebo',  s.hasPlacebo ? 'Yes' : 'No'],
              ['Outcomes',     String(s.numPrimaryOutcomes)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '2px 0' }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <CopyButton text={s.nctId}/>
            <a href={ctUrl} target="_blank" rel="noopener noreferrer" style={{
              padding: '2px 10px', borderRadius: 5, fontSize: 9, fontWeight: 700,
              background: '#6366f1', color: '#fff', textDecoration: 'none', border: 'none',
            }}>
              Open on CT.gov ↗
            </a>
            <button
              onClick={() => { navigator.clipboard.writeText(ctUrl); }}
              style={{
                padding: '2px 8px', borderRadius: 5, border: '1px solid var(--border)',
                background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: 9, cursor: 'pointer',
              }}>
              Copy link
            </button>
          </div>

          {/* Eligibility tip */}
          {s.criteriaLength > 0 && (
            <div style={{ fontSize: 9, color: 'var(--text-muted)', padding: '4px 8px', background: color + '08', borderRadius: 5, border: `1px solid ${color}20` }}>
              📋 This trial has eligibility criteria ({(s.criteriaLength / 1000).toFixed(1)}k chars).{' '}
              <a href={`${ctUrl}?tab=eligibility`} target="_blank" rel="noopener noreferrer" style={{ color, textDecoration: 'none' }}>
                View full criteria ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  localStudies: CTStudy[];  // studies already fetched in the training dataset
}

export default function TrialSearchPanel({ onClose, localStudies }: Props) {
  const [query,        setQuery]        = useState('');
  const [phases,       setPhases]       = useState<CTPhase[]>([]);
  const [statuses,     setStatuses]     = useState<string[]>([]);
  const [sponsors,     setSponsors]     = useState<string[]>([]);
  const [results,      setResults]      = useState<CTStudy[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [searched,     setSearched]     = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [source,       setSource]       = useState<'live' | 'local'>('live');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const togglePhase = (p: CTPhase) =>
    setPhases(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p]);
  const toggleStatus = (s: string) =>
    setStatuses(ps => ps.includes(s) ? ps.filter(x => x !== s) : [...ps, s]);
  const toggleSponsor = (s: string) =>
    setSponsors(ps => ps.includes(s) ? ps.filter(x => x !== s) : [...ps, s]);

  const doSearch = useCallback(async (overrideQuery?: string) => {
    const q = overrideQuery ?? query;
    setSearching(true);
    setError(null);

    if (source === 'local') {
      // Search locally-fetched studies
      const q_lower = q.toLowerCase();
      let filtered = localStudies;
      if (q_lower.trim()) {
        filtered = filtered.filter(s =>
          s.briefTitle.toLowerCase().includes(q_lower) ||
          s.nctId.toLowerCase().includes(q_lower)
        );
      }
      if (phases.length)   filtered = filtered.filter(s => phases.includes(s.primaryPhase));
      if (statuses.length) filtered = filtered.filter(s => statuses.includes(s.overallStatus));
      if (sponsors.length) filtered = filtered.filter(s => sponsors.includes(s.sponsorClass));
      setResults(filtered);
      setSearched(true);
      setSearching(false);
      return;
    }

    // Live search
    try {
      const res = await searchClinicalTrials(q, {
        phase: phases.length ? phases : undefined,
        status: statuses.length ? statuses : undefined,
        sponsorClass: sponsors.length ? sponsors : undefined,
        pageSize: 50,
      });
      setResults(res);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }, [query, phases, statuses, sponsors, source, localStudies]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch();
  };

  const usePreset = (p: string) => {
    setQuery(p);
    setTimeout(() => doSearch(p), 0);
  };

  const clearAll = () => {
    setQuery(''); setPhases([]); setStatuses([]); setSponsors([]);
    setResults([]); setSearched(false); setError(null);
  };

  const hasFilters = phases.length + statuses.length + sponsors.length > 0;

  return (
    // Overlay backdrop
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      {/* Drawer */}
      <div style={{
        width: 'min(720px, 95vw)', height: '100%', overflow: 'hidden',
        background: 'var(--bg)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.2s ease-out',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '16px 20px 12px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                🔬 Clinical Trial Finder
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                Search ClinicalTrials.gov to connect people with relevant studies
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'var(--surface2)', color: 'var(--text-muted)',
              fontSize: 16, cursor: 'pointer', lineHeight: 1,
            }}>✕</button>
          </div>

          {/* Search bar */}
          <div style={{ display: 'flex', gap: 6 }}>
            {/* Source toggle */}
            <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 8, padding: 3, gap: 2, flexShrink: 0 }}>
              {(['live', 'local'] as const).map(s => (
                <button key={s} onClick={() => setSource(s)} style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: source === s ? '#6366f1' : 'transparent',
                  color: source === s ? '#fff' : 'var(--text-muted)',
                  fontSize: 10, fontWeight: 700,
                }}>
                  {s === 'live' ? '🌐 Live' : `💾 Local${localStudies.length ? ` (${localStudies.length})` : ''}`}
                </button>
              ))}
            </div>

            {/* Input */}
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="e.g. breast cancer, Alzheimer, NCT04280991, diabetes GLP-1…"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 13,
                outline: 'none',
              }}
            />

            <button onClick={() => doSearch()} disabled={searching} style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0,
              background: searching ? '#334155' : 'linear-gradient(135deg,#6366f1,#22d3ee)',
            }}>
              {searching ? '⟳' : '🔍 Search'}
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div style={{
          padding: '10px 20px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 7,
        }}>
          {/* Phase row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 52, flexShrink: 0 }}>Phase</span>
            {ALL_PHASES.map(p => (
              <Chip key={p} label={PHASE_LABELS[p]} active={phases.includes(p)}
                color={PHASE_COLORS[p]} onClick={() => togglePhase(p)}/>
            ))}
          </div>

          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 52, flexShrink: 0 }}>Status</span>
            {STATUS_OPTIONS.map(s => (
              <Chip key={s.value} label={s.label} active={statuses.includes(s.value)}
                color={STATUS_COLORS[s.value]} onClick={() => toggleStatus(s.value)}/>
            ))}
          </div>

          {/* Sponsor row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 52, flexShrink: 0 }}>Sponsor</span>
            {SPONSOR_OPTIONS.map(s => (
              <Chip key={s.value} label={s.label} active={sponsors.includes(s.value)}
                onClick={() => toggleSponsor(s.value)}/>
            ))}
            {hasFilters && (
              <button onClick={clearAll} style={{
                marginLeft: 'auto', fontSize: 10, color: '#f43f5e', background: 'none',
                border: 'none', cursor: 'pointer', fontWeight: 600,
              }}>✕ Clear all</button>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Presets (shown before first search) */}
          {!searched && !searching && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 7, fontWeight: 600 }}>
                  Common searches
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PRESET_QUERIES.map(p => (
                    <button key={p} onClick={() => usePreset(p)} style={{
                      padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)',
                      background: 'var(--surface2)', color: 'var(--text-muted)',
                      fontSize: 11, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = '#6366f1'; (e.target as HTMLButtonElement).style.color = '#6366f1'; }}
                    onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.target as HTMLButtonElement).style.color = 'var(--text-muted)'; }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div style={{
                background: 'var(--surface)', borderRadius: 10, padding: '12px 14px',
                border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#22d3ee' }}>💡 Tips for helping people</div>
                {[
                  'Add "recruiting" status to find trials actively enrolling patients',
                  'Use "Phase III" to find trials closer to standard-of-care evidence',
                  'Search by drug name (e.g. "pembrolizumab") to find trials using that treatment',
                  'Copy the NCT ID and share it — patients can look it up on clinicaltrials.gov',
                  'Use "NIH" sponsor filter for publicly funded studies (often no cost to participate)',
                ].map((tip, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                    <span style={{ color: '#6366f1', flexShrink: 0 }}>›</span>{tip}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {searching && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{
                  height: 70, borderRadius: 10, background: 'var(--surface2)',
                  border: '1px solid var(--border)', opacity: 1 - i * 0.15,
                  animation: 'shimmer 1.2s infinite',
                }}/>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, background: 'rgba(244,63,94,0.08)',
              border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', fontSize: 12,
            }}>
              ⚠ {error}
              {source === 'live' && (
                <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
                  The Vite proxy to ClinicalTrials.gov must be running. Try switching to Local if data is already fetched.
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {searched && !searching && !error && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {results.length === 0
                    ? 'No trials found — try broadening your search'
                    : <><strong style={{ color: 'var(--text)' }}>{results.length}</strong> trials found
                      {source === 'live' && results.length === 50 && ' (showing first 50)'}</>
                  }
                </div>
                {results.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    click any row to expand details
                  </div>
                )}
              </div>

              {results.map(s => (
                <TrialCard key={s.nctId} s={s} query={query}/>
              ))}

              {results.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>No matching trials</div>
                  <div style={{ fontSize: 11 }}>Try a different condition, remove filters, or switch to Live search.</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '8px 20px', borderTop: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, color: '#475569' }}>
            Data from <a href="https://clinicaltrials.gov" target="_blank" rel="noopener noreferrer"
              style={{ color: '#22d3ee', textDecoration: 'none' }}>ClinicalTrials.gov</a> (NLM/NIH) · Not medical advice
          </span>
          <span style={{ fontSize: 10, color: '#334155' }}>ESC to close</span>
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(60px); opacity:0 } to { transform: translateX(0); opacity:1 } }
        @keyframes shimmer { 0%,100% { opacity:.4 } 50% { opacity:.7 } }
      `}</style>
    </div>
  );
}
