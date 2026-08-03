import { useMemo } from 'react';

const LAYER_INFO: Record<string, { color: string; dims: string }> = {
  input:  { color: '#6366f1', dims: '224×224' },
  conv1:  { color: '#22d3ee', dims: '112×112' },
  pool1:  { color: '#f59e0b', dims: '56×56'   },
  conv2:  { color: '#22d3ee', dims: '56×56'   },
  conv3:  { color: '#22d3ee', dims: '28×28'   },
  pool2:  { color: '#f59e0b', dims: '14×14'   },
  conv4:  { color: '#22d3ee', dims: '14×14'   },
  pool3:  { color: '#f59e0b', dims: '7×7'     },
  fc1:    { color: '#22c55e', dims: '4096'     },
  drop1:  { color: '#f43f5e', dims: '4096'     },
  fc2:    { color: '#22c55e', dims: '1024'     },
  output: { color: '#a78bfa', dims: '10'       },
};

// Deterministic "activation" grid seeded by layerId + epoch + filterIdx
function seededGrid(layerId: string, epoch: number, filterIdx: number, rows = 8, cols = 8): number[][] {
  let seed = layerId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 31 + epoch * 7 + filterIdx * 13;
  function rand() {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return ((seed >>> 0) / 0xffffffff);
  }
  // Apply spatial patterns based on epoch (training progress = sharper features)
  const sharpness = Math.min(1, epoch / 40);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const raw = rand();
      // Simulate feature emergence: early = noise, late = structured
      const pattern = Math.sin(r * 0.8 + filterIdx) * Math.cos(c * 0.8 + filterIdx * 0.5) * 0.5 + 0.5;
      return raw * (1 - sharpness) + pattern * sharpness;
    })
  );
}

function heatColor(v: number, color: string): string {
  // Interpolate from near-black to the layer's accent color
  const [r, g, b] = color === '#22d3ee' ? [34, 211, 238]
    : color === '#22c55e' ? [34, 197, 94]
    : color === '#f59e0b' ? [245, 158, 11]
    : color === '#f43f5e' ? [244, 63, 94]
    : color === '#a78bfa' ? [167, 139, 250]
    : [99, 102, 241];
  return `rgb(${Math.round(13 + v * r)},${Math.round(15 + v * g)},${Math.round(26 + v * b * 0.8)})`;
}

interface HeatGridProps { grid: number[][]; color: string; size?: number; }

function HeatGrid({ grid, color, size = 130 }: HeatGridProps) {
  const rows = grid.length, cols = grid[0].length;
  const cell = size / Math.max(rows, cols);
  return (
    <div style={{ display: 'inline-block', lineHeight: 0 }}>
      {grid.map((row, ri) => (
        <div key={ri} style={{ display: 'flex' }}>
          {row.map((val, ci) => (
            <div key={ci} style={{ width: cell, height: cell, background: heatColor(val, color) }}/>
          ))}
        </div>
      ))}
    </div>
  );
}

interface Props {
  selectedLayer: string;
  epoch: number;
}

export default function ActivationsPanel({ selectedLayer, epoch }: Props) {
  const info = LAYER_INFO[selectedLayer] ?? { color: '#6366f1', dims: '?' };

  // Generate 4 filter maps; re-compute when layer or epoch (every 5) changes
  const grids = useMemo(() => (
    [0, 1, 2, 3].map(i => seededGrid(selectedLayer, Math.floor(epoch / 5) * 5, i))
  ), [selectedLayer, epoch]);

  const isFC = ['fc1', 'fc2', 'output', 'drop1'].includes(selectedLayer);

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <p className="card-title" style={{ margin: 0 }}>Activations</p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: info.color, fontWeight: 700 }}>{selectedLayer}</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--surface2)', borderRadius: 4, padding: '1px 5px' }}>
            {info.dims}
          </span>
        </div>
      </div>

      {/* Feature maps grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minHeight: 0 }}>
        {grids.map((g, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minHeight: 0 }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              {isFC ? `Neuron group ${i + 1}` : `Filter ${i + 1}`}
            </div>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <HeatGrid grid={g} color={info.color} size={115}/>
            </div>
            <div style={{ fontSize: 8, color: '#334155' }}>
              max: {Math.max(...g.flat()).toFixed(2)}  avg: {(g.flat().reduce((a,b)=>a+b,0)/g.flat().length).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {/* Color scale */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>0.0</span>
        <div style={{
          flex: 1, height: 6, borderRadius: 3,
          background: `linear-gradient(to right, #0d0f1a, ${info.color})`,
        }}/>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>1.0</span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 8 }}>epoch {epoch}</span>
      </div>
    </div>
  );
}
