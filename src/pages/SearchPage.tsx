import { useState, useCallback, useRef, useEffect } from 'react';
import { searchClinicalTrialsPage } from '../services/clinicalTrialsAPI';
import type { CTStudy, CTPhase } from '../services/clinicalTrialsAPI';

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<CTPhase, string> = {
  PHASE1: 'Phase I', PHASE2: 'Phase II', PHASE3: 'Phase III', PHASE4: 'Phase IV', NA: 'N/A',
};
const PHASE_COLORS: Record<CTPhase, string> = {
  PHASE1: '#6366f1', PHASE2: '#22d3ee', PHASE3: '#22c55e', PHASE4: '#a78bfa', NA: '#64748b',
};
const ALL_PHASES: CTPhase[] = ['PHASE1', 'PHASE2', 'PHASE3', 'PHASE4'];

const STATUS_OPTIONS = [
  { label: 'Recruiting',              value: 'RECRUITING' },
  { label: 'Active, not recruiting',  value: 'ACTIVE_NOT_RECRUITING' },
  { label: 'Completed',               value: 'COMPLETED' },
  { label: 'Not yet recruiting',      value: 'NOT_YET_RECRUITING' },
  { label: 'Enrolling by invitation', value: 'ENROLLING_BY_INVITATION' },
];
const SPONSOR_OPTIONS = [
  { label: 'Industry', value: 'INDUSTRY' },
  { label: 'NIH',      value: 'NIH' },
  { label: 'U.S. Fed', value: 'FED' },
  { label: 'Other',    value: 'OTHER' },
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
  'heart failure SGLT2',
  'CRISPR gene therapy',
  'mRNA vaccine cancer',
  'Parkinson disease neuroprotection',
];

// ── Small helper components ───────────────────────────────────────────────────

function Chip({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12,
      border: `1px solid ${active ? (color ?? '#6366f1') : 'var(--border)'}`,
      background: active ? (color ?? '#6366f1') + '22' : 'var(--surface2)',
      color: active ? (color ?? '#6366f1') : 'var(--text-muted)',
      fontWeight: active ? 700 : 400, transition: 'all 0.15s',
    }}>{label}</button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#64748b';
  const label = status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, flexShrink: 0,
      background: color + '18', color, border: `1px solid ${color}40`,
    }}>{label}</span>
  );
}

// ── Trial result card ─────────────────────────────────────────────────────────

function TrialCard({ s, query }: { s: CTStudy; query: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const color = PHASE_COLORS[s.primaryPhase];
  const ctUrl = `https://clinicaltrials.gov/study/${s.nctId}`;

  const titleHtml = query.trim()
    ? s.briefTitle.replace(
        new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
        '<mark style="background:#6366f122;color:#a5b4fc;border-radius:2px">$1</mark>'
      )
    : s.briefTitle;

  const copyId = () => {
    navigator.clipboard.writeText(s.nctId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 12,
      border: `1px solid ${open ? color + '50' : 'var(--border)'}`,
      overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s',
      boxShadow: open ? `0 0 0 1px ${color}20` : 'none',
    }}>
      {/* Header row */}
      <div style={{ padding: '14px 18px', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <span style={{
            fontSize: 10, padding: '3px 10px', borderRadius: 10, flexShrink: 0, marginTop: 2,
            background: color + '20', color, border: `1px solid ${color}40`, fontWeight: 700,
          }}>
            {PHASE_LABELS[s.primaryPhase]}
          </span>
          <span
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.45, flex: 1 }}
            dangerouslySetInnerHTML={{ __html: titleHtml }}
          />
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: 14, marginTop: 2 }}>
            {open ? '▲' : '▼'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.nctId}</code>
          <StatusBadge status={s.overallStatus} />
          {s.enrollmentCount > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>n={s.enrollmentCount.toLocaleString()}</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {s.sponsorClass.charAt(0) + s.sponsorClass.slice(1).toLowerCase()}
          </span>
          {s.interventionTypes.slice(0, 3).map((t, i) => (
            <span key={`${t}-${i}`} style={{
              fontSize: 10, padding: '1px 7px', borderRadius: 4,
              background: 'var(--surface2)', color: '#94a3b8', border: '1px solid var(--border)',
            }}>{t.toLowerCase()}</span>
          ))}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{
          borderTop: `1px solid ${color}25`, padding: '14px 18px',
          background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 20px' }}>
            {[
              ['Study type',  s.studyType.replace(/_/g, ' ')],
              ['Allocation',  s.allocation || '—'],
              ['Masking',     s.masking || '—'],
              ['Purpose',     s.primaryPurpose?.replace(/_/g, ' ') || '—'],
              ['Arms',        String(s.numArms)],
              ['Conditions',  String(s.numConditions)],
              ['Outcomes',    String(s.numPrimaryOutcomes)],
              ['Has placebo', s.hasPlacebo ? 'Yes' : 'No'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={copyId} style={{
              padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--surface)', color: copied ? '#22c55e' : 'var(--text-muted)',
              fontSize: 11, cursor: 'pointer',
            }}>{copied ? '✓ Copied' : 'Copy NCT ID'}</button>
            <a href={ctUrl} target="_blank" rel="noopener noreferrer" style={{
              padding: '4px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: '#6366f1', color: '#fff', textDecoration: 'none',
            }}>Open on CT.gov ↗</a>
            <button onClick={() => navigator.clipboard.writeText(ctUrl)} style={{
              padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
            }}>Copy link</button>
          </div>

          {s.criteriaLength > 0 && (
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', padding: '6px 10px',
              background: color + '08', borderRadius: 6, border: `1px solid ${color}20`,
            }}>
              📋 Eligibility criteria available ({(s.criteriaLength / 1000).toFixed(1)}k chars).{' '}
              <a href={`${ctUrl}?tab=eligibility`} target="_blank" rel="noopener noreferrer"
                style={{ color, textDecoration: 'none', fontWeight: 600 }}>View ↗</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [query,      setQuery]      = useState('');
  const [phases,     setPhases]     = useState<CTPhase[]>([]);
  const [statuses,   setStatuses]   = useState<string[]>([]);
  const [sponsors,   setSponsors]   = useState<string[]>([]);
  const [results,    setResults]    = useState<CTStudy[]>([]);
  const [nextToken,  setNextToken]  = useState<string | undefined>();
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searching,  setSearching]  = useState(false);
  const [loadingMore,setLoadingMore]= useState(false);
  const [searched,   setSearched]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  // Snapshot of the query/filters used for the current result set (for "Load more")
  const activeSearch = useRef<{ q: string; phases: CTPhase[]; statuses: string[]; sponsors: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const toggle = <T extends string>(setter: React.Dispatch<React.SetStateAction<T[]>>) =>
    (val: T) => setter(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);

  const doSearch = useCallback(async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (!q && !phases.length && !statuses.length && !sponsors.length) return;
    setSearching(true);
    setError(null);
    setResults([]);
    setNextToken(undefined);
    activeSearch.current = { q, phases, statuses, sponsors };
    try {
      const page = await searchClinicalTrialsPage(q, {
        phase: phases.length ? phases : undefined,
        status: statuses.length ? statuses : undefined,
        sponsorClass: sponsors.length ? sponsors : undefined,
        pageSize: 100,
      });
      setResults(page.studies);
      setNextToken(page.nextPageToken);
      setTotalCount(page.totalCount);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }, [query, phases, statuses, sponsors]);

  const loadMore = async () => {
    if (!nextToken || !activeSearch.current) return;
    setLoadingMore(true);
    try {
      const { q, phases: p, statuses: st, sponsors: sp } = activeSearch.current;
      const page = await searchClinicalTrialsPage(q, {
        phase: p.length ? p : undefined,
        status: st.length ? st : undefined,
        sponsorClass: sp.length ? sp : undefined,
        pageSize: 100,
      }, nextToken);
      setResults(prev => [...prev, ...page.studies]);
      setNextToken(page.nextPageToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const usePreset = (p: string) => {
    setQuery(p);
    setTimeout(() => doSearch(p), 0);
  };

  const clearAll = () => {
    setQuery(''); setPhases([]); setStatuses([]); setSponsors([]);
    setResults([]); setSearched(false); setError(null); setNextToken(undefined);
    activeSearch.current = null;
    inputRef.current?.focus();
  };

  const hasFilters = phases.length + statuses.length + sponsors.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top nav ── */}
      <nav style={{
        padding: '12px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🧬</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.3 }}>
            ClinicalTrials<span style={{ color: '#6366f1' }}>Search</span>
          </span>
        </a>
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Searching across <strong style={{ color: 'var(--text)' }}>500,000+</strong> trials from ClinicalTrials.gov
        </span>
        <div style={{ flex: 1 }} />
        <a href="/" style={{
          fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', padding: '5px 12px',
          border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)',
          fontWeight: 600, transition: 'color 0.15s',
        }}>← DNN Dashboard</a>
      </nav>

      {/* ── Search area ── */}
      <div style={{
        maxWidth: 860, width: '100%', margin: '0 auto', padding: '40px 24px 0',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Hero heading (only before first search) */}
        {!searched && !searching && (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text)', letterSpacing: -1, lineHeight: 1.2 }}>
              Find Clinical Trials
            </div>
            <div style={{ fontSize: 15, color: 'var(--text-muted)', marginTop: 8 }}>
              Search the full ClinicalTrials.gov database in real time — no sign-up required
            </div>
          </div>
        )}

        {/* Search bar */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
            placeholder="Disease, drug, NCT ID, sponsor… e.g. breast cancer immunotherapy"
            style={{
              flex: 1, padding: '13px 16px', borderRadius: 10, fontSize: 15,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text)', outline: 'none',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
          <button
            onClick={() => doSearch()}
            disabled={searching || (!hasQuery && !hasFilters)}
            style={{
              padding: '13px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 800, fontSize: 14, color: '#fff', flexShrink: 0,
              background: searching ? '#334155' : 'linear-gradient(135deg,#6366f1,#22d3ee)',
              opacity: (!hasQuery && !hasFilters) ? 0.5 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {searching ? '⟳ Searching…' : '🔍 Search'}
          </button>
          {(hasQuery || hasFilters || searched) && (
            <button onClick={clearAll} style={{
              padding: '13px 14px', borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
            }}>✕</button>
          )}
        </div>

        {/* Filters */}
        <div style={{
          background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
          padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {[
          { label: 'Phase',  chips: ALL_PHASES.map(p => ({ label: PHASE_LABELS[p], value: p as string, color: PHASE_COLORS[p] })), active: phases as string[], toggle: toggle<CTPhase>(setPhases) as (v: string) => void },
          { label: 'Status', chips: STATUS_OPTIONS.map(s => ({ ...s, color: STATUS_COLORS[s.value] })), active: statuses, toggle: toggle<string>(setStatuses) },
          { label: 'Sponsor', chips: SPONSOR_OPTIONS, active: sponsors, toggle: toggle<string>(setSponsors) },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, width: 48, flexShrink: 0 }}>{row.label}</span>
              {row.chips.map((c: { label: string; value: string; color?: string }) => (
                <Chip key={c.value} label={c.label} active={row.active.includes(c.value)}
                  color={c.color} onClick={() => row.toggle(c.value as never)} />
              ))}
            </div>
          ))}
          {hasFilters && (
            <button onClick={() => { setPhases([]); setStatuses([]); setSponsors([]); }} style={{
              alignSelf: 'flex-end', fontSize: 11, color: '#f43f5e', background: 'none',
              border: 'none', cursor: 'pointer', fontWeight: 700,
            }}>✕ Clear filters</button>
          )}
        </div>

        {/* Preset chips (before first search) */}
        {!searched && !searching && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600 }}>
              Common searches
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PRESET_QUERIES.map(p => (
                <button key={p} onClick={() => usePreset(p)} style={{
                  padding: '7px 14px', borderRadius: 20, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text-muted)',
                  fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                }}>{p}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      <div style={{ maxWidth: 860, width: '100%', margin: '0 auto', padding: '24px 24px 48px', flex: 1 }}>

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 8, background: '#f43f5e18',
            border: '1px solid #f43f5e40', color: '#f43f5e', fontSize: 13, marginBottom: 16,
          }}>⚠️ {error}</div>
        )}

        {/* Result count header */}
        {searched && !searching && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Showing <strong style={{ color: 'var(--text)' }}>{results.length.toLocaleString()}</strong>
              {totalCount > results.length && (
                <> of <strong style={{ color: 'var(--text)' }}>{totalCount.toLocaleString()}</strong></>
              )} results
            </span>
            {/* Phase breakdown */}
            {results.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ALL_PHASES.map(p => {
                  const count = results.filter(s => s.primaryPhase === p).length;
                  if (!count) return null;
                  return (
                    <span key={p} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                      background: PHASE_COLORS[p] + '18', color: PHASE_COLORS[p],
                      border: `1px solid ${PHASE_COLORS[p]}40`,
                    }}>{PHASE_LABELS[p]}: {count}</span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Result cards */}
        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.map(s => <TrialCard key={s.nctId} s={s} query={activeSearch.current?.q ?? query} />)}

            {/* Load more */}
            {nextToken && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  marginTop: 8, padding: '12px 24px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--surface)', color: loadingMore ? 'var(--text-muted)' : 'var(--text)',
                  fontSize: 13, fontWeight: 700, cursor: loadingMore ? 'default' : 'pointer',
                  width: '100%',
                }}
              >
                {loadingMore ? '⟳ Loading more…' : `Load more results (${(totalCount - results.length).toLocaleString()} remaining)`}
              </button>
            )}
          </div>
        )}

        {/* No results */}
        {searched && !searching && results.length === 0 && !error && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: 'var(--text-muted)', fontSize: 14,
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            No trials matched your search. Try different keywords or remove some filters.
          </div>
        )}

        {/* Loading skeleton */}
        {searching && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{
                height: 80, borderRadius: 12, background: 'var(--surface)',
                border: '1px solid var(--border)',
                animation: 'pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`,
              }} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
