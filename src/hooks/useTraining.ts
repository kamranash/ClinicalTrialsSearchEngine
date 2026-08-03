import { useState, useRef, useCallback, useEffect } from 'react';

export interface TrainingConfig {
  lr: number;
  batchSize: number;
  dropout: number;
  wd: number;
  momentum: number;
  maxEpochs: number;
  optimizer: string;
  scheduler: string;
}

export interface EpochRecord {
  epoch: number;
  trainLoss: number;
  valLoss: number;
  trainAcc: number;
  valAcc: number;
  lr: number;
}

// Per-layer gradient norms for backprop visualization
export const GRAD_LAYERS = ['output','fc2','drop1','fc1','pool3','conv4','pool2','conv3','conv2','pool1','conv1'] as const;
export type GradLayer = typeof GRAD_LAYERS[number];

export interface GradientRecord {
  epoch: number;
  gradNorms:  Record<GradLayer, number>; // L2 norm of gradients
  weightUpd:  Record<GradLayer, number>; // magnitude of weight update
  vanishing:  boolean;                   // detected vanishing gradient
  exploding:  boolean;                   // detected exploding gradient
}

export type TrainingStatus = 'idle' | 'running' | 'paused' | 'done';

export const DEFAULT_CONFIG: TrainingConfig = {
  lr: 0.001,
  batchSize: 64,
  dropout: 0.3,
  wd: 0.0001,
  momentum: 0.9,
  maxEpochs: 60,
  optimizer: 'Adam',
  scheduler: 'CosineAnnealing',
};

const OPTIMIZER_FACTOR: Record<string, number> = {
  SGD: 0.65, Adam: 1.0, AdamW: 1.08, RMSProp: 0.88, Adagrad: 0.8,
};

const SCHEDULER_FACTOR: Record<string, number> = {
  None: 0.98, StepLR: 0.96, CosineAnnealing: 1.0, ReduceOnPlateau: 0.97, OneCycleLR: 1.12,
};

// 4-class tabular classification: random start ≈ -ln(0.25) = 1.386
function makeInitial(cfg: TrainingConfig): EpochRecord {
  return { epoch: 0, trainLoss: 1.39, valLoss: 1.42, trainAcc: 0.252, valAcc: 0.241, lr: cfg.lr };
}

function makeGradRecord(epoch: number, loss: number, cfg: TrainingConfig): GradientRecord {
  const noise = () => 0.85 + Math.random() * 0.3;
  // Gradient norms decay from output → input (depth attenuation)
  const baseNorm = loss * 0.65;
  const attenuation = cfg.optimizer === 'Adam' || cfg.optimizer === 'AdamW' ? 0.82 : 0.72;
  const gradNorms = {} as Record<GradLayer, number>;
  const weightUpd = {} as Record<GradLayer, number>;
  GRAD_LAYERS.forEach((l, i) => {
    const g = Math.max(1e-8, baseNorm * Math.pow(attenuation, i) * noise());
    gradNorms[l] = +g.toFixed(5);
    weightUpd[l] = +(g * cfg.lr * noise() * 0.5).toFixed(6);
  });
  const minNorm = Math.min(...Object.values(gradNorms));
  const maxNorm = Math.max(...Object.values(gradNorms));
  return {
    epoch,
    gradNorms,
    weightUpd,
    vanishing: minNorm < 1e-5,
    exploding: maxNorm > 10,
  };
}

function stepEpoch(prev: EpochRecord, cfg: TrainingConfig): EpochRecord {
  const e = prev.epoch + 1;
  const speed = (cfg.lr / 0.001) * (OPTIMIZER_FACTOR[cfg.optimizer] ?? 1) * (SCHEDULER_FACTOR[cfg.scheduler] ?? 1);
  // Tabular data: less noise, faster convergence than image data
  const noise = 0.06 / Math.sqrt(cfg.batchSize / 64);
  const overfit = (1 - cfg.dropout) * 0.0008;
  const r = () => (Math.random() - 0.5) * 2;

  let effLr = cfg.lr;
  if (cfg.scheduler === 'StepLR') {
    effLr *= Math.pow(0.5, Math.floor(e / 15));
  } else if (cfg.scheduler === 'CosineAnnealing') {
    effLr = cfg.lr * 0.5 * (1 + Math.cos(Math.PI * e / cfg.maxEpochs));
  } else if (cfg.scheduler === 'OneCycleLR') {
    const t = e / cfg.maxEpochs;
    effLr = cfg.lr * (t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7);
  }

  // Tabular convergence: loss from ~1.39 → ~0.35, acc from ~0.25 → ~0.82
  const decay = Math.max(0.91, 0.972 - Math.min(0.05, speed * 0.022));
  const trainLoss = Math.max(0.28, prev.trainLoss * decay + r() * noise * prev.trainLoss * 0.15);
  const valLoss   = Math.max(0.32, trainLoss * (1 + overfit * e) + Math.abs(r()) * noise * 0.10);
  const accGain   = speed * 0.018 * (1 - prev.trainAcc);
  const trainAcc  = Math.min(0.91, prev.trainAcc + accGain + r() * noise * 0.010);
  const valAcc    = Math.min(0.875, trainAcc - overfit * e * 0.25 + r() * noise * 0.008);

  return {
    epoch: e,
    trainLoss: +trainLoss.toFixed(4),
    valLoss:   +valLoss.toFixed(4),
    trainAcc:  +Math.max(0.25, trainAcc).toFixed(4),
    valAcc:    +Math.max(0.24, valAcc).toFixed(4),
    lr: +effLr.toFixed(6),
  };
}

export function useTraining() {
  const [history,     setHistory]     = useState<EpochRecord[]>([makeInitial(DEFAULT_CONFIG)]);
  const [gradHistory, setGradHistory] = useState<GradientRecord[]>([]);
  const [status,      setStatus]      = useState<TrainingStatus>('idle');
  const [config,      setConfig]      = useState<TrainingConfig>(DEFAULT_CONFIG);
  const [speed,       setSpeed]       = useState(1);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const cfgRef    = useRef(config);
  const speedRef  = useRef(speed);

  useEffect(() => { cfgRef.current = config; },  [config]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const runTimer = useCallback(() => {
    stop();
    timerRef.current = setInterval(() => {
      setHistory(prev => {
        const cfg = cfgRef.current;
        const last = prev[prev.length - 1];
        if (!last || last.epoch >= cfg.maxEpochs) {
          stop();
          setStatus('done');
          return prev;
        }
        let cur = prev;
        const newGrads: GradientRecord[] = [];
        for (let i = 0; i < speedRef.current && cur[cur.length - 1].epoch < cfg.maxEpochs; i++) {
          const next = stepEpoch(cur[cur.length - 1], cfg);
          newGrads.push(makeGradRecord(next.epoch, next.trainLoss, cfg));
          cur = [...cur, next];
        }
        if (newGrads.length) setGradHistory(g => [...g, ...newGrads]);
        return cur;
      });
    }, 100);
  }, [stop]);

  const start = useCallback(() => {
    setStatus(s => {
      if (s === 'idle' || s === 'paused') { runTimer(); return 'running'; }
      if (s === 'done') {
        setHistory([makeInitial(cfgRef.current)]);
        setTimeout(runTimer, 30);
        return 'running';
      }
      return s;
    });
  }, [runTimer]);

  const pause = useCallback(() => {
    stop();
    setStatus(s => s === 'running' ? 'paused' : s);
  }, [stop]);

  const reset = useCallback(() => {
    stop();
    setHistory([makeInitial(cfgRef.current)]);
    setGradHistory([]);
    setStatus('idle');
  }, [stop]);

  const retrain = useCallback((newCfg: TrainingConfig) => {
    stop();
    cfgRef.current = newCfg;
    setConfig(newCfg);
    setHistory([makeInitial(newCfg)]);
    setGradHistory([]);
    setStatus('running');
    setTimeout(runTimer, 30);
  }, [stop, runTimer]);

  useEffect(() => () => stop(), [stop]);

  const current = history[history.length - 1];
  const currentGrad = gradHistory[gradHistory.length - 1] ?? null;
  return { history, gradHistory, currentGrad, status, current, config, speed, setSpeed, start, pause, reset, retrain };
}
