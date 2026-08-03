import type { TrainingConfig, EpochRecord } from '../hooks/useTraining';

export interface ModelVersion {
  id:          string;
  tag:         string;
  createdAt:   string;
  notes:       string;
  config:      TrainingConfig;
  metrics:     {
    finalLoss:    number;
    finalAcc:     number;
    finalValLoss: number;
    finalValAcc:  number;
    epoch:        number;
    lr:           number;
  };
  datasetSize: number | null;
}

const BASE = '/api';

export async function listModelVersions(): Promise<ModelVersion[]> {
  const res = await fetch(`${BASE}/models`);
  if (!res.ok) throw new Error(`Registry ${res.status}`);
  return res.json();
}

export async function saveModelVersion(
  tag:         string,
  notes:       string,
  config:      TrainingConfig,
  lastEpoch:   EpochRecord,
  datasetSize: number | null,
): Promise<ModelVersion> {
  const res = await fetch(`${BASE}/models`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag,
      notes,
      config,
      metrics: {
        finalLoss:    lastEpoch.trainLoss,
        finalAcc:     lastEpoch.trainAcc,
        finalValLoss: lastEpoch.valLoss,
        finalValAcc:  lastEpoch.valAcc,
        epoch:        lastEpoch.epoch,
        lr:           lastEpoch.lr,
      },
      datasetSize,
    }),
  });
  if (res.status === 409) {
    const err = await res.json();
    throw new Error(err.error ?? 'Duplicate tag');
  }
  if (!res.ok) throw new Error(`Registry ${res.status}`);
  return res.json();
}

export async function deleteModelVersion(id: string): Promise<void> {
  const res = await fetch(`${BASE}/models/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`Registry ${res.status}`);
}

export async function updateModelNotes(id: string, notes: string): Promise<ModelVersion> {
  const res = await fetch(`${BASE}/models/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error(`Registry ${res.status}`);
  return res.json();
}
