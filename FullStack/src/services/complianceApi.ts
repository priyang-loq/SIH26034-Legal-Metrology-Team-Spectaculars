import { ScanResult, RegulatorTrendData, ClauseStatistic, SellerHistoryItem } from '../types';
import { MOCK_SCAN_RESULTS, MOCK_REGULATOR_TRENDS, MOCK_CLAUSE_STATISTICS, MOCK_SELLER_HISTORY } from '../data/mockComplianceData';

/**
 * COMPLIANCE SCANNER API CLIENT (SIH26034)
 * =============================================================================
 * This service handles product label scanning, OCR extraction, and Legal Metrology
 * (Packaged Commodities) Rules, 2011 rule-checking.
 * 
 * For development and hackathon demo, mock responses are simulated with realistic
 * latency and full statutory clause analysis.
 * 
 * TO CONNECT REAL BACKEND:
 * Replace the mock implementation in `analyzeProductLabel` with a standard `fetch` call
 * to your backend server (e.g., `POST /api/scan-label` with multipart/form-data).
 * =============================================================================
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface LabelAnalysisOptions {
  productTitle?: string;
  category?: string;
  packType?: string;
  principalAreaCm2?: number;
  simulatedPresetId?: string;
  submittedBy?: 'seller' | 'consumer';
  brand?: string;
  barcode?: string;
  packType_?: string;
}

async function isBackendReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function analyzeProductLabel(
  fileOrUrl: File | string,
  options?: LabelAnalysisOptions
): Promise<ScanResult> {
  // Try the real backend first (Node/Express + rule engine). If it isn't
  // running - e.g. during early frontend-only development - fall back to the
  // original mock behaviour below so the UI never breaks.
  if (typeof fileOrUrl !== 'string' && !options?.simulatedPresetId) {
    const formData = new FormData();
    formData.append('image', fileOrUrl);
    formData.append('submittedBy', options?.submittedBy || 'consumer');
    if (options?.productTitle) formData.append('productTitle', options.productTitle);
    if (options?.category) formData.append('category', options.category);
    if (options?.packType) formData.append('packType', options.packType);
    if (options?.brand) formData.append('brand', options.brand);
    if (options?.barcode) formData.append('barcode', options.barcode);
    if (options?.principalAreaCm2) {
      formData.append('extractedFields', JSON.stringify({
        extractedFields: undefined,
        principalDisplayAreaCm2: options.principalAreaCm2
      }));
    }

    const res = await fetch(`${API_BASE}/scan-label`, { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      return { ...data, imageUrl: data.imageUrl?.startsWith('/') ? `${API_BASE.replace('/api', '')}${data.imageUrl}` : data.imageUrl };
    }
    const err = await res.json().catch(() => ({ error: 'Compliance scan failed on the server.' }));
    throw new Error(err.error || 'Compliance scan failed on the server.');
  }

  // ---- MOCK FALLBACK BELOW (used when the backend is unreachable) ----
  // SIMULATE NETWORK & OCR INFERENCE LATENCY (1200ms)
  await new Promise(resolve => setTimeout(resolve, 1200));

  // If a preset scan ID was provided or matches
  if (options?.simulatedPresetId) {
    const match = MOCK_SCAN_RESULTS.find(s => s.id === options.simulatedPresetId);
    if (match) return JSON.parse(JSON.stringify(match));
  }

  // If a File object was uploaded, generate dynamic scan result or match closest
  if (typeof fileOrUrl !== 'string') {
    const fileName = fileOrUrl.name.toLowerCase();
    
    // Choose appropriate mock or synthesize compliant/non-compliant result
    if (fileName.includes('pass') || fileName.includes('good') || fileName.includes('compliant') || fileName.includes('almond') || fileName.includes('ghee')) {
      const passMock = MOCK_SCAN_RESULTS.find(s => s.overallStatus === 'COMPLIANT') || MOCK_SCAN_RESULTS[1];
      const result: ScanResult = JSON.parse(JSON.stringify(passMock));
      result.id = `LM-LIVE-${Math.floor(10000 + Math.random() * 90000)}`;
      result.timestamp = new Date().toISOString();
      result.productTitle = options?.productTitle || fileOrUrl.name.replace(/\.[^/.]+$/, "");
      result.imageUrl = URL.createObjectURL(fileOrUrl);
      return result;
    } else {
      // Default to non-compliant to highlight violation detection capabilities
      const failMock = MOCK_SCAN_RESULTS.find(s => s.overallStatus === 'NON_COMPLIANT') || MOCK_SCAN_RESULTS[0];
      const result: ScanResult = JSON.parse(JSON.stringify(failMock));
      result.id = `LM-LIVE-${Math.floor(10000 + Math.random() * 90000)}`;
      result.timestamp = new Date().toISOString();
      result.productTitle = options?.productTitle || (fileOrUrl.name.replace(/\.[^/.]+$/, "") || 'Sample Scanned Package');
      result.imageUrl = URL.createObjectURL(fileOrUrl);
      return result;
    }
  }

  // String URL fallback
  const directMatch = MOCK_SCAN_RESULTS.find(s => s.imageUrl === fileOrUrl);
  if (directMatch) return JSON.parse(JSON.stringify(directMatch));

  return JSON.parse(JSON.stringify(MOCK_SCAN_RESULTS[0]));
}

/**
 * Fetch Regulator Dashboard Analytics
 */

/**
 * Submit officer review/edit of scan fields.
 */
export async function submitScanReview(scanId: string, overrides: Record<string, string>): Promise<ScanResult> {
  const reachable = await isBackendReachable();
  if (!reachable) {
    throw new Error('Backend is not reachable for review submission.');
  }

  const res = await fetch(`${API_BASE}/scan-label/${scanId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field_overrides: overrides }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit review');
  }

  const data = await res.json();
  return { ...data, imageUrl: data.imageUrl?.startsWith('/') ? `${API_BASE.replace('/api', '')}${data.imageUrl}` : data.imageUrl };
}

export async function fetchRegulatorAnalytics(): Promise<{
  trends: RegulatorTrendData[];
  topClauses: ClauseStatistic[];
  recentScans: ScanResult[];
  kpis: {
    totalAudited: number;
    nonComplianceRate: number;
    statutoryNoticesCount: number;
    topOffendingClause: string;
    resolvedGrievances: number;
  };
}> {
  const reachable = await isBackendReachable();
  if (reachable) {
    try {
      const res = await fetch(`${API_BASE}/regulator/analytics`);
      if (res.ok) return res.json();
    } catch {
      // fall through to mock data below
    }
  }

  await new Promise(resolve => setTimeout(resolve, 200));

  const totalAudited = 34970;
  const nonComplianceRate = 22.4;
  const statutoryNoticesCount = 1842;
  const topOffendingClause = 'Rule 6(1)(e) (MRP/USP)';
  const resolvedGrievances = 914;

  return {
    trends: MOCK_REGULATOR_TRENDS,
    topClauses: MOCK_CLAUSE_STATISTICS,
    recentScans: MOCK_SCAN_RESULTS,
    kpis: {
      totalAudited,
      nonComplianceRate,
      statutoryNoticesCount,
      topOffendingClause,
      resolvedGrievances
    }
  };
}

/**
 * Fetch Seller Self-Check Scan History
 */
export async function fetchSellerHistory(): Promise<SellerHistoryItem[]> {
  const reachable = await isBackendReachable();
  if (reachable) {
    try {
      const res = await fetch(`${API_BASE}/seller/history`);
      if (res.ok) return res.json();
    } catch {
      // fall through to mock data below
    }
  }

  await new Promise(resolve => setTimeout(resolve, 200));
  return MOCK_SELLER_HISTORY;
}
