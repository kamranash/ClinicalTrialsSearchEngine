// ─── MLP Architecture for clinical trial phase classification ─────────────────
// Input: 16 engineered features from ClinicalTrials.gov
// Output: 4-class softmax (Phase I / II / III / IV)

export interface LayerDef {
  id: string;
  label: string;
  type: 'input' | 'conv' | 'pool' | 'fc' | 'dropout' | 'output';
  params: string;
  shape: string;  // human-readable tensor shape
}

export const networkLayers: LayerDef[] = [
  { id: 'input',  label: 'Input\n16 features',    type: 'input',   params: '–',       shape: '(B, 16)'  },
  { id: 'dense1', label: 'Dense\n256',             type: 'fc',      params: '4,352',   shape: '(B, 256)' },
  { id: 'bn1',    label: 'BatchNorm\n256',         type: 'pool',    params: '1,024',   shape: '(B, 256)' },
  { id: 'drop1',  label: 'Dropout\n0.3',           type: 'dropout', params: '0',       shape: '(B, 256)' },
  { id: 'dense2', label: 'Dense\n128',             type: 'fc',      params: '32,896',  shape: '(B, 128)' },
  { id: 'bn2',    label: 'BatchNorm\n128',         type: 'pool',    params: '512',     shape: '(B, 128)' },
  { id: 'drop2',  label: 'Dropout\n0.3',           type: 'dropout', params: '0',       shape: '(B, 128)' },
  { id: 'dense3', label: 'Dense\n64',              type: 'fc',      params: '8,256',   shape: '(B, 64)'  },
  { id: 'dense4', label: 'Dense\n32',              type: 'fc',      params: '2,080',   shape: '(B, 32)'  },
  { id: 'output', label: 'Softmax\n4 phases',      type: 'output',  params: '132',     shape: '(B, 4)'   },
];

export const networkEdges = networkLayers
  .slice(0, -1)
  .map((l, i) => ({ id: `e${i}`, source: l.id, target: networkLayers[i + 1].id }));

// ─── Inference Samples (phase prediction on real CT features) ─────────────────

export type CTPhase = 'PHASE1' | 'PHASE2' | 'PHASE3' | 'PHASE4';
export const PHASE_LABELS: Record<CTPhase, string> = {
  PHASE1: 'Phase I', PHASE2: 'Phase II', PHASE3: 'Phase III', PHASE4: 'Phase IV',
};
export const PHASE_COLORS: Record<CTPhase, string> = {
  PHASE1: '#6366f1', PHASE2: '#22d3ee', PHASE3: '#22c55e', PHASE4: '#a78bfa',
};

export interface InferenceSample {
  id: number;
  nctId: string;
  title: string;
  label: CTPhase;         // true phase
  predicted: CTPhase;     // model prediction
  correct: boolean;
  probs: { cls: CTPhase; prob: number }[];
  color: string;
  // Key features shown in UI
  sponsorClass: string;
  enrollment: number;
  allocation: string;
  interventionType: string;
}

const PHASES: CTPhase[] = ['PHASE1', 'PHASE2', 'PHASE3', 'PHASE4'];

function makePhaseProbs(predicted: CTPhase): { cls: CTPhase; prob: number }[] {
  const raw = PHASES.map(p => ({ cls: p, p: Math.random() * 0.3 }));
  raw.find(r => r.cls === predicted)!.p = 0.45 + Math.random() * 0.35;
  const total = raw.reduce((s, r) => s + r.p, 0);
  return raw.map(r => ({ cls: r.cls, prob: +(r.p / total).toFixed(3) }))
            .sort((a, b) => b.prob - a.prob);
}

// Representative mock samples with realistic CT data
export const inferenceSamples: InferenceSample[] = [
  {
    id: 1, nctId: 'NCT05012345', title: 'First-in-human dose escalation of XRT-201 in advanced solid tumors',
    label: 'PHASE1', predicted: 'PHASE1', correct: true,
    probs: makePhaseProbs('PHASE1'), color: PHASE_COLORS.PHASE1,
    sponsorClass: 'INDUSTRY', enrollment: 30, allocation: 'NA', interventionType: 'DRUG',
  },
  {
    id: 2, nctId: 'NCT04872041', title: 'Randomized controlled efficacy of pembrolizumab in NSCLC',
    label: 'PHASE2', predicted: 'PHASE2', correct: true,
    probs: makePhaseProbs('PHASE2'), color: PHASE_COLORS.PHASE2,
    sponsorClass: 'INDUSTRY', enrollment: 120, allocation: 'RANDOMIZED', interventionType: 'BIOLOGICAL',
  },
  {
    id: 3, nctId: 'NCT03991234', title: 'Pivotal trial of CardioBlock vs standard of care in MI patients',
    label: 'PHASE3', predicted: 'PHASE3', correct: true,
    probs: makePhaseProbs('PHASE3'), color: PHASE_COLORS.PHASE3,
    sponsorClass: 'INDUSTRY', enrollment: 2400, allocation: 'RANDOMIZED', interventionType: 'DRUG',
  },
  {
    id: 4, nctId: 'NCT06124809', title: 'Long-term safety surveillance of Vaxtera in pediatric population',
    label: 'PHASE4', predicted: 'PHASE3', correct: false,
    probs: makePhaseProbs('PHASE3'), color: PHASE_COLORS.PHASE4,
    sponsorClass: 'INDUSTRY', enrollment: 5000, allocation: 'NON_RANDOMIZED', interventionType: 'VACCINE',
  },
  {
    id: 5, nctId: 'NCT05559012', title: 'Safety and tolerability of BTK inhibitor in relapsed CLL',
    label: 'PHASE1', predicted: 'PHASE2', correct: false,
    probs: makePhaseProbs('PHASE2'), color: PHASE_COLORS.PHASE1,
    sponsorClass: 'NIH', enrollment: 45, allocation: 'NA', interventionType: 'DRUG',
  },
  {
    id: 6, nctId: 'NCT04001122', title: 'Double-blind RCT of NovaMab in moderate-to-severe Crohn\'s disease',
    label: 'PHASE2', predicted: 'PHASE2', correct: true,
    probs: makePhaseProbs('PHASE2'), color: PHASE_COLORS.PHASE2,
    sponsorClass: 'INDUSTRY', enrollment: 280, allocation: 'RANDOMIZED', interventionType: 'BIOLOGICAL',
  },
];
