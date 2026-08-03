import { useState } from 'react';
import { networkLayers, networkEdges } from '../data/mockData';
import type { LayerDef } from '../data/mockData';
import { FEATURE_NAMES } from '../services/clinicalTrialsAPI';

const TYPE_COLORS: Record<LayerDef['type'], string> = {
  input:   '#6366f1',
  conv:    '#22d3ee',  // unused in MLP but kept for type safety
  pool:    '#f59e0b',  // reused for BatchNorm
  fc:      '#22c55e',
  dropout: '#f43f5e',
  output:  '#a78bfa',
};

const TYPE_LABEL: Partial<Record<LayerDef['type'], string>> = {
  pool: 'BatchNorm',
};

// ─── SVG MLP visualization ────────────────────────────────────────────────────

// Node counts per layer (visual representation)
const VISUAL_NODES: Record<string, number> = {
  input: 16, dense1: 12, bn1: 12, drop1: 10, dense2: 9,
  bn2: 9, drop2: 8, dense3: 7, dense4: 6, output: 4,
};

const SVG_H = 360;
const LAYER_SPC = 90;
const SVG_W = networkLayers.length * LAYER_SPC + 40;
const CENTER_Y = SVG_H / 2;
const LABEL_H = 50;
const DRAW_H = SVG_H - LABEL_H;

interface NodePos { x: number; y: number; color: string; r: number; }

function computeMLPNodes(layerId: string, color: string, cx: number): NodePos[] {
  const count = VISUAL_NODES[layerId] ?? 8;
  const r = layerId === 'input' ? 4 : layerId === 'output' ? 7 : 5;
  const gap = r * 2 + 3;
  const totalH = count * gap;
  const startY = CENTER_Y - DRAW_H / 2 + (DRAW_H - totalH) / 2 + r;
  return Array.from({ length: count }, (_, i) => ({
    x: cx, y: startY + i * gap, color, r,
  }));
}

interface BezierConn { path: string; color: string; fromIdx: number; }

const allLayerData = networkLayers.map((layer, i) => {
  const cx = 20 + i * LAYER_SPC + LAYER_SPC / 2;
  const color = TYPE_COLORS[layer.type];
  return { layer, cx, nodes: computeMLPNodes(layer.id, color, cx) };
});

// Sparse bezier connections
const bezierConns: BezierConn[] = [];
for (let i = 0; i < allLayerData.length - 1; i++) {
  const { nodes: fn, layer: fl } = allLayerData[i];
  const { nodes: tn } = allLayerData[i + 1];
  fn.forEach((f, fi) => {
    tn.forEach((t, ti) => {
      if ((fi * 3 + ti * 2) % 7 < 2) {
        const mx = (f.x + t.x) / 2;
        bezierConns.push({
          path: `M${f.x + f.r},${f.y} C${mx},${f.y} ${mx},${t.y} ${t.x - t.r},${t.y}`,
          color: TYPE_COLORS[fl.type], fromIdx: i,
        });
      }
    });
  });
}

const totalParams = networkLayers.reduce((s, l) => s + (parseInt(l.params.replace(/,/g, '')) || 0), 0);

// ─── SVG component ────────────────────────────────────────────────────────────

interface SVGProps { selectedLayer: string; onSelectLayer: (id: string) => void; }

function MLPNetSVG({ selectedLayer, onSelectLayer }: SVGProps) {
  const [hovIdx, setHovIdx] = useState<number | null>(null);
  const selIdx = allLayerData.findIndex(d => d.layer.id === selectedLayer);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ minWidth: 700, width: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="mlpBg" x1="0" y1="0" x2="1" y2="0">
            {networkLayers.map((l, i) => (
              <stop key={i} offset={`${(i / (networkLayers.length - 1)) * 100}%`}
                stopColor={TYPE_COLORS[l.type]} stopOpacity="0.04"/>
            ))}
          </linearGradient>
        </defs>
        <rect width={SVG_W} height={SVG_H} fill="url(#mlpBg)" rx={10}/>

        {/* Connections */}
        {bezierConns.map((c, i) => {
          const active = hovIdx !== null
            ? (c.fromIdx === hovIdx || c.fromIdx + 1 === hovIdx)
            : (c.fromIdx === selIdx || c.fromIdx + 1 === selIdx);
          return (
            <path key={i} d={c.path} stroke={c.color} fill="none"
              strokeWidth={active ? 0.9 : 0.3} strokeOpacity={active ? 0.7 : 0.12}/>
          );
        })}

        {/* Layer columns */}
        {allLayerData.map(({ layer, cx, nodes }, idx) => {
          const isSel = selIdx === idx, isHov = hovIdx === idx;
          const color = TYPE_COLORS[layer.type];
          return (
            <g key={layer.id} onClick={() => onSelectLayer(layer.id)}
              onMouseEnter={() => setHovIdx(idx)} onMouseLeave={() => setHovIdx(null)}
              style={{ cursor: 'pointer' }}>
              {(isSel || isHov) && (
                <rect x={cx - LAYER_SPC / 2 + 5} y={4}
                  width={LAYER_SPC - 10} height={SVG_H - LABEL_H - 8}
                  rx={8} fill={color} fillOpacity={isSel ? 0.10 : 0.05}
                  stroke={color} strokeWidth={isSel ? 1.2 : 0.7} strokeOpacity={isSel ? 0.8 : 0.3}/>
              )}
              {nodes.map((n, ni) => (
                <circle key={ni} cx={n.x} cy={n.y} r={n.r}
                  fill={color} fillOpacity={(isSel || isHov) ? 0.95 : 0.5}
                  stroke={color} strokeWidth={0.5}/>
              ))}
              {/* Layer label */}
              <text x={cx} y={SVG_H - LABEL_H + 14} textAnchor="middle"
                fill={(isSel || isHov) ? color : '#94a3b8'} fontSize={isSel ? 11 : 9} fontWeight={700}>
                {layer.label.split('\n')[0]}
              </text>
              <text x={cx} y={SVG_H - LABEL_H + 25} textAnchor="middle" fill="#475569" fontSize={8}>
                {layer.label.split('\n')[1]}
              </text>
              <text x={cx} y={SVG_H - LABEL_H + 35} textAnchor="middle" fill="#334155" fontSize={7.5}>
                {(layer as LayerDef).shape}
              </text>
              {idx < allLayerData.length - 1 && (
                <text x={cx + LAYER_SPC / 2} y={CENTER_Y - DRAW_H / 2 + DRAW_H / 2 + 4}
                  textAnchor="middle" fill="#334155" fontSize={12}>›</text>
              )}
            </g>
          );
        })}

        {/* Input feature labels (shown on hover of input layer) */}
        {selIdx === 0 && FEATURE_NAMES.map((name, i) => {
          const cx = allLayerData[0].cx;
          const node = allLayerData[0].nodes[i];
          if (!node) return null;
          return (
            <text key={i} x={cx - 8} y={node.y + 3} textAnchor="end"
              fontSize={6.5} fill="#6366f1" opacity={0.85}>{name}</text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props { selectedLayer: string; onSelectLayer: (id: string) => void; }

export default function ArchitecturePanel({ selectedLayer, onSelectLayer }: Props) {
  const sel = networkLayers.find(l => l.id === selectedLayer);
  const typeLabel = sel ? (TYPE_LABEL[sel.type] ?? sel.type.toUpperCase()) : '';

  // Network edges list for scrollable detail — kept for future use
  void networkEdges;

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <p className="card-title" style={{ margin: 0 }}>MLP Architecture</p>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>click a layer</span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        {([
          ['fc', 'Dense'], ['pool', 'BatchNorm'], ['dropout', 'Dropout'],
          ['input', 'Input'], ['output', 'Output'],
        ] as [LayerDef['type'], string][]).map(([t, label]) => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: 'var(--text-muted)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: TYPE_COLORS[t], display: 'inline-block' }}/>
            {label}
          </span>
        ))}
      </div>

      {/* SVG */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <MLPNetSVG selectedLayer={selectedLayer} onSelectLayer={onSelectLayer}/>
      </div>

      {/* Selected layer info */}
      {sel && (
        <div style={{
          background: 'var(--surface2)', borderRadius: 8, padding: '7px 10px',
          border: `1px solid ${TYPE_COLORS[sel.type]}35`, flexShrink: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 10, color: TYPE_COLORS[sel.type], fontWeight: 700, marginBottom: 1 }}>
              {typeLabel} · {sel.label.replace('\n', ' ')}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              params: {sel.params} &nbsp;·&nbsp; shape: {sel.shape}
            </div>
          </div>
          <div style={{
            background: TYPE_COLORS[sel.type] + '18', border: `1px solid ${TYPE_COLORS[sel.type]}40`,
            borderRadius: 6, padding: '4px 10px', fontSize: 11, color: TYPE_COLORS[sel.type], fontWeight: 800,
          }}>
            {sel.id === 'input' ? '16→' : sel.id === 'output' ? '→4' : '→'}
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-around', flexShrink: 0 }}>
        {[
          { label: 'Total Params', value: totalParams.toLocaleString(), color: '#6366f1' },
          { label: 'Depth',        value: String(networkLayers.length),  color: '#22d3ee' },
          { label: 'Task',         value: '4-class',                     color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
