import type { EpochRecord, TrainingStatus } from '../hooks/useTraining';

// ─── Custom SVG line chart ────────────────────────────────────────────────────

interface LineSpec { key: keyof EpochRecord; color: string; label: string; dash?: boolean; }

interface ChartProps {
  data: EpochRecord[];
  lines: LineSpec[];
  height?: number;
  yFmt?: (v: number) => string;
  yDomain?: [number, number];
}

function SVGLineChart({ data, lines, height = 130, yFmt, yDomain }: ChartProps) {
  const W = 500, H = height;
  const p = { t: 10, b: 22, l: 40, r: 10 };
  const iW = W - p.l - p.r, iH = H - p.t - p.b;

  if (data.length < 2) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}>
        <rect x={p.l} y={p.t} width={iW} height={iH} fill="rgba(27,31,53,0.6)" rx={4}/>
        <text x={W / 2} y={H / 2 + 2} textAnchor="middle" fontSize={9} fill="#475569">
          Press ▶ Train to start
        </text>
      </svg>
    );
  }

  const allVals = data.flatMap(d => lines.map(l => d[l.key] as number));
  const minV = yDomain?.[0] ?? Math.min(...allVals);
  const maxV = yDomain?.[1] ?? Math.max(...allVals);
  const vR = maxV - minV || 1;
  const cx = (i: number) => p.l + (i / Math.max(1, data.length - 1)) * iW;
  const cy = (v: number) => p.t + (1 - (v - minV) / vR) * iH;

  const yTicks = Array.from({ length: 5 }, (_, i) => minV + (vR * i / 4));
  const xStep  = Math.max(1, Math.floor(data.length / 6));
  const xTicks = data.filter((_, i) => i % xStep === 0 || i === data.length - 1);
  const fmt    = yFmt ?? ((v: number) => v.toFixed(2));
  const clipId = `clip-${lines[0].key}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}>
      <defs>
        <clipPath id={clipId}><rect x={p.l} y={p.t} width={iW} height={iH}/></clipPath>
      </defs>
      <rect x={p.l} y={p.t} width={iW} height={iH} fill="rgba(27,31,53,0.55)" rx={4}/>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={p.l} y1={cy(v)} x2={p.l + iW} y2={cy(v)} stroke="#252944" strokeWidth={0.6} strokeDasharray="3,3"/>
          <text x={p.l - 4} y={cy(v) + 3.5} textAnchor="end" fontSize={7} fill="#475569">{fmt(v)}</text>
        </g>
      ))}
      {xTicks.map((d, i) => (
        <text key={i} x={cx(data.indexOf(d))} y={H - 5} textAnchor="middle" fontSize={7} fill="#334155">{d.epoch}</text>
      ))}
      {lines.map(l => {
        const pts = data.map((d, i) => `${cx(i).toFixed(1)},${cy(d[l.key] as number).toFixed(1)}`).join(' ');
        return (
          <polyline key={l.key} points={pts} fill="none" stroke={l.color} strokeWidth={1.6}
            clipPath={`url(#${clipId})`} strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={l.dash ? '5,3' : undefined}/>
        );
      })}
      {lines.map(l => {
        const last = data[data.length - 1];
        return <circle key={l.key} cx={cx(data.length - 1)} cy={cy(last[l.key] as number)} r={3} fill={l.color}/>;
      })}
      <text x={p.l + iW / 2} y={H - 2} textAnchor="middle" fontSize={6.5} fill="#334155">epoch</text>
    </svg>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface Props {
  history: EpochRecord[];
  status: TrainingStatus;
  maxEpochs: number;
}

const PILL_COLORS = ['#6366f1', '#f43f5e', '#22d3ee', '#22c55e'];

export default function MetricsPanel({ history, status, maxEpochs }: Props) {
  const current = history[history.length - 1];
  const epoch   = current?.epoch ?? 0;

  const pills = current ? [
    { label: 'Train Loss', value: current.trainLoss.toFixed(4) },
    { label: 'Val Loss',   value: current.valLoss.toFixed(4)   },
    { label: 'Train Acc',  value: `${(current.trainAcc * 100).toFixed(1)}%` },
    { label: 'Val Acc',    value: `${(current.valAcc  * 100).toFixed(1)}%` },
  ] : [];

  const lossLines = [
    { key: 'trainLoss' as const, color: '#6366f1', label: 'Train' },
    { key: 'valLoss'   as const, color: '#f43f5e', label: 'Val', dash: true },
  ];

  const accLines = [
    { key: 'trainAcc' as const, color: '#22d3ee', label: 'Train' },
    { key: 'valAcc'   as const, color: '#22c55e', label: 'Val', dash: true },
  ];

  const isRunning = status === 'running';

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <p className="card-title" style={{ margin: 0 }}>Training Metrics</p>
        <span style={{ fontSize: 11, color: isRunning ? '#22c55e' : '#64748b', fontWeight: 600 }}>
          {isRunning ? '● Live' : status === 'paused' ? '⏸ Paused' : status === 'done' ? '✓ Done' : 'Epoch ' + epoch}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ background: 'var(--surface2)', borderRadius: 3, height: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${(epoch / maxEpochs) * 100}%`, height: '100%',
          background: 'linear-gradient(to right, #6366f1, #22d3ee)',
          transition: 'width 0.12s linear', borderRadius: 3,
        }}/>
      </div>

      {/* Stat pills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
        {pills.map((p, i) => (
          <div key={p.label} style={{
            background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 8px',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{p.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: PILL_COLORS[i], fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
              {p.value}
            </div>
          </div>
        ))}
      </div>

      {/* Loss chart */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>Loss</span>
          <span style={{ color: '#6366f1' }}>— Train</span>
          <span style={{ color: '#f43f5e' }}>-- Val</span>
          {current && (
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 9 }}>
              LR: {current.lr.toExponential(2)}
            </span>
          )}
        </div>
        <SVGLineChart data={history} lines={lossLines} height={125}/>
      </div>

      {/* Accuracy chart */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>Accuracy</span>
          <span style={{ color: '#22d3ee' }}>— Train</span>
          <span style={{ color: '#22c55e' }}>-- Val</span>
        </div>
        <SVGLineChart data={history} lines={accLines} height={125}
          yFmt={v => `${(v * 100).toFixed(0)}%`} yDomain={[0, 1]}/>
      </div>
    </div>
  );
}
