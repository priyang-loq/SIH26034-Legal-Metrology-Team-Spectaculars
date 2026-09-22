const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface CoverageNote {
  title: string;
  note: string;
}

export interface CategoryExemptionInfo {
  name: string;
  skipAll: boolean;
  exemptFields: string[];
  conditionalExemptFields: string[];
  reason: string;
}

export interface RuleCoverageInfo {
  unverified: CoverageNote[];
  deferred: CoverageNote[];
  categoryExemptions: CategoryExemptionInfo[];
}

export async function fetchRuleCoverage(): Promise<RuleCoverageInfo> {
  const res = await fetch(`${API_BASE}/rule-coverage`);
  if (!res.ok) throw new Error('Failed to load rule coverage notes.');
  return res.json();
}

export async function fetchScanById(scanId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/scan-label/${encodeURIComponent(scanId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Scan not found.' }));
    throw new Error(err.error || 'Scan not found.');
  }
  return res.json();
}
