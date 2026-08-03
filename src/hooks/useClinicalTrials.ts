import { useState, useCallback } from 'react';
import { fetchClinicalTrialsDataset, buildDatasetStats } from '../services/clinicalTrialsAPI';
import type { DatasetStats } from '../services/clinicalTrialsAPI';

export type FetchStatus = 'idle' | 'fetching' | 'done' | 'error';

export function useClinicalTrials() {
  const [fetchStatus, setFetchStatus]   = useState<FetchStatus>('idle');
  const [progress,    setProgress]      = useState('');
  const [progressPct, setProgressPct]   = useState(0);
  const [dataset,     setDataset]       = useState<DatasetStats | null>(null);
  const [error,       setError]         = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setFetchStatus('fetching');
    setError(null);
    setProgress('Connecting to ClinicalTrials.gov…');
    setProgressPct(0);
    try {
      const studies = await fetchClinicalTrialsDataset((msg, pct) => {
        setProgress(msg);
        setProgressPct(pct);
      });
      if (studies.length === 0) throw new Error('No studies returned');
      const stats = buildDatasetStats(studies);
      setDataset(stats);
      setProgress(`Loaded ${stats.total} studies`);
      setProgressPct(100);
      setFetchStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFetchStatus('error');
    }
  }, []);

  return { fetchStatus, progress, progressPct, dataset, error, fetchData };
}
