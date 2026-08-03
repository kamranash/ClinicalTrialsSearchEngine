// ClinicalTrials.gov v2 API service
// Proxied through Vite's dev server to avoid CORS: /ct-api → clinicaltrials.gov/api/v2

export type CTPhase = 'PHASE1' | 'PHASE2' | 'PHASE3' | 'PHASE4' | 'NA';

export interface CTStudy {
  nctId:            string;
  briefTitle:       string;
  phases:           CTPhase[];
  primaryPhase:     CTPhase;   // resolved single label used as training target
  overallStatus:    string;
  enrollmentCount:  number;
  studyType:        string;
  allocation:       string;
  masking:          string;
  primaryPurpose:   string;
  sponsorClass:     string;
  interventionTypes:string[];
  numPrimaryOutcomes:number;
  numConditions:    number;
  criteriaLength:   number;
  numArms:          number;
  hasPlacebo:       boolean;
}

// 16-dimensional feature vector
export interface CTFeatureVector {
  nctId: string;
  label: CTPhase;
  labelIndex: number; // 0–3
  features: number[]; // length 16
}

export const FEATURE_NAMES = [
  'log_enrollment',    // log1p(enrollment) / log1p(50000)
  'is_industry',       // sponsor = INDUSTRY
  'is_nih',            // sponsor = NIH
  'is_randomized',     // allocation = RANDOMIZED
  'masking_score',     // 0=none → 1=quadruple
  'is_treatment',      // purpose = TREATMENT
  'is_drug',           // primary intervention = DRUG or BIOLOGICAL
  'is_device',         // primary intervention = DEVICE
  'num_interventions', // min(n,5)/5
  'num_outcomes',      // min(n,10)/10
  'num_conditions',    // min(n,5)/5
  'num_arms',          // min(n,6)/6
  'has_placebo',       // placebo mentioned in criteria
  'criteria_length',   // len/5000 capped at 1
  'is_interventional', // studyType = INTERVENTIONAL
  'has_biomarker',     // biomarker/genomic mentioned in criteria
];

const PHASE_ORDER: CTPhase[] = ['PHASE1', 'PHASE2', 'PHASE3', 'PHASE4'];

const MASKING_SCORE: Record<string, number> = {
  NONE: 0, SINGLE: 0.25, DOUBLE: 0.5, TRIPLE: 0.75, QUADRUPLE: 1.0,
};

function primaryPhaseOf(phases: string[]): CTPhase {
  if (!phases?.length) return 'NA';
  for (const p of PHASE_ORDER) if (phases.includes(p)) return p;
  return 'NA'; // includes 'NA', 'EARLY_PHASE1', observational, etc.
}

function extractStudy(raw: Record<string, unknown>): CTStudy | null {
  const ps  = raw.protocolSection as Record<string, unknown>;
  if (!ps) return null;
  const im  = ps.identificationModule as Record<string, unknown>;
  const sm  = ps.statusModule         as Record<string, unknown>;
  const dm  = ps.designModule         as Record<string, unknown>;
  const di  = dm?.designInfo          as Record<string, unknown> | undefined;
  const ei  = dm?.enrollmentInfo      as Record<string, unknown> | undefined;
  const mi  = di?.maskingInfo         as Record<string, unknown> | undefined;
  const sp  = (ps.sponsorCollaboratorsModule as Record<string, unknown>)?.leadSponsor as Record<string, unknown>;
  const aim = ps.armsInterventionsModule as Record<string, unknown>;
  const om  = ps.outcomesModule        as Record<string, unknown>;
  const em  = ps.eligibilityModule     as Record<string, unknown>;
  const cm  = ps.conditionsModule      as Record<string, unknown>;

  const phases = (dm?.phases as string[]) ?? [];
  const primary = primaryPhaseOf(phases);

  const interventions = (aim?.interventions as Record<string, unknown>[]) ?? [];
  const criteria = (em?.eligibilityCriteria as string) ?? '';

  return {
    nctId:             (im?.nctId as string) ?? '',
    briefTitle:        (im?.briefTitle as string) ?? '',
    phases:            phases as CTPhase[],
    primaryPhase:      primary,
    overallStatus:     (sm?.overallStatus as string) ?? '',
    enrollmentCount:   (ei?.count as number) ?? 0,
    studyType:         (dm?.studyType as string) ?? '',
    allocation:        (di?.allocation as string) ?? '',
    masking:           (mi?.masking as string) ?? 'NONE',
    primaryPurpose:    (di?.primaryPurpose as string) ?? '',
    sponsorClass:      (sp?.class as string) ?? '',
    interventionTypes: [...new Set(interventions.map(i => i.type as string))],
    numPrimaryOutcomes:((om?.primaryOutcomes as unknown[]) ?? []).length,
    numConditions:     ((cm?.conditions as unknown[]) ?? []).length,
    criteriaLength:    criteria.length,
    numArms:           ((aim?.armGroups as unknown[]) ?? []).length,
    hasPlacebo:        /placebo/i.test(criteria),
  };
}

export function toFeatureVector(s: CTStudy): CTFeatureVector {
  const f: number[] = [
    Math.log1p(s.enrollmentCount) / Math.log1p(50000),
    s.sponsorClass === 'INDUSTRY' ? 1 : 0,
    s.sponsorClass === 'NIH' ? 1 : 0,
    s.allocation === 'RANDOMIZED' ? 1 : s.allocation === 'NON_RANDOMIZED' ? 0.5 : 0,
    MASKING_SCORE[s.masking] ?? 0,
    s.primaryPurpose === 'TREATMENT' ? 1 : 0,
    s.interventionTypes.some(t => t === 'DRUG' || t === 'BIOLOGICAL') ? 1 : 0,
    s.interventionTypes.some(t => t === 'DEVICE') ? 1 : 0,
    Math.min(s.interventionTypes.length, 5) / 5,
    Math.min(s.numPrimaryOutcomes, 10) / 10,
    Math.min(s.numConditions, 5) / 5,
    Math.min(s.numArms, 6) / 6,
    s.hasPlacebo ? 1 : 0,
    Math.min(s.criteriaLength / 5000, 1),
    s.studyType === 'INTERVENTIONAL' ? 1 : 0,
    /biomarker|genomic|mutation|variant/i.test(
      s.briefTitle + ' ' + s.primaryPurpose
    ) ? 1 : 0,
  ];
  return {
    nctId: s.nctId,
    label: s.primaryPhase,
    labelIndex: PHASE_ORDER.indexOf(s.primaryPhase),
    features: f,
  };
}

export interface SearchFilters {
  phase?: CTPhase[];
  status?: string[];
  sponsorClass?: string[];
  pageSize?: number;
}

// Live free-text search against ClinicalTrials.gov API
export async function searchClinicalTrials(
  query: string,
  filters: SearchFilters = {}
): Promise<CTStudy[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set('query.term', query.trim());

  // Phase filter
  if (filters.phase?.length) {
    params.set('filter.phase', filters.phase.join(' OR '));
  }
  // Status filter
  if (filters.status?.length) {
    params.set('filter.overallStatus', filters.status.join(','));
  }

  params.set('pageSize', String(filters.pageSize ?? 25));
  params.set('format', 'json');

  const url = `/ct-api/studies?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CT API ${res.status}: ${res.statusText}`);
  const data = await res.json() as { studies?: Record<string, unknown>[] };
  const studies: CTStudy[] = [];
  for (const raw of data.studies ?? []) {
    const s = extractStudy(raw);
    if (s) {
      // Apply sponsor filter client-side (not supported in query params)
      if (filters.sponsorClass?.length && !filters.sponsorClass.includes(s.sponsorClass)) continue;
      // Apply phase client-side fallback
      if (filters.phase?.length && !filters.phase.includes(s.primaryPhase)) continue;
      studies.push(s);
    }
  }
  return studies;
}

// Fetch up to `pageSize` studies using the given search terms
async function fetchPage(queryTerm: string, pageSize: number): Promise<CTStudy[]> {
  const url = `/ct-api/studies?query.term=${encodeURIComponent(queryTerm)}&pageSize=${pageSize}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CT API ${res.status}`);
  const data = await res.json() as { studies?: Record<string, unknown>[] };
  const studies: CTStudy[] = [];
  for (const raw of data.studies ?? []) {
    const s = extractStudy(raw);
    if (s) studies.push(s);
  }
  return studies;
}

// Fetch a balanced dataset: query different terms to get a mix of phases
export async function fetchClinicalTrialsDataset(
  onProgress: (msg: string, pct: number) => void
): Promise<CTStudy[]> {
  // Queries targeted to increase representation of each phase
  const queries: [string, number][] = [
    ['phase 1 first-in-human dose escalation drug',         60],
    ['phase 2 randomized controlled efficacy',              60],
    ['phase 3 pivotal randomized controlled trial',         60],
    ['phase 4 post-marketing surveillance long-term',       40],
    ['phase 1 2 oncology immunotherapy',                    40],
    ['phase 2 3 cardiovascular randomized double-blind',    40],
  ];

  const all: CTStudy[] = [];
  for (let i = 0; i < queries.length; i++) {
    const [term, size] = queries[i];
    onProgress(`Fetching batch ${i + 1}/${queries.length}…`, Math.round((i / queries.length) * 80));
    try {
      const batch = await fetchPage(term, size);
      all.push(...batch);
    } catch {
      // continue on individual batch failure
    }
    // Small delay to be polite to the API
    await new Promise(r => setTimeout(r, 200));
  }

  // Deduplicate by nctId
  const seen = new Set<string>();
  const deduped = all.filter(s => {
    if (seen.has(s.nctId)) return false;
    seen.add(s.nctId);
    return true;
  });

  onProgress('Processing features…', 90);
  return deduped;
}

export interface DatasetStats {
  total: number;
  byPhase: Record<CTPhase, number>;
  features: CTFeatureVector[];
  studies: CTStudy[];
}

export function buildDatasetStats(studies: CTStudy[]): DatasetStats {
  const byPhase: Record<CTPhase, number> = { PHASE1: 0, PHASE2: 0, PHASE3: 0, PHASE4: 0, NA: 0 };
  const features: CTFeatureVector[] = [];
  for (const s of studies) {
    byPhase[s.primaryPhase]++;
    // Only include studies with a known phase in the training feature set
    if (s.primaryPhase !== 'NA') features.push(toFeatureVector(s));
  }
  return { total: studies.length, byPhase, features, studies };
}
