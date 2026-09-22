import { InspectionDetail } from '../types';
import { API_BASE, actorHeaders } from './authApi';

/**
 * PLACEHOLDER client - talks only to /api/public-check, which is a mock
 * stand-in for the real scanner (see server/data/mockProductChecks.js and
 * server/routes/publicCheck.routes.js for why). Nothing here calls
 * /api/scan-label or touches complianceApi.ts's analyzeProductLabel, which is
 * the real scanning integration point your teammate owns.
 *
 * TO SWAP IN THE REAL SCANNER: change checkMockProduct's fetch target (and
 * however the dashboard collects input - a product picker vs. an image
 * upload) to call the real endpoint, then delete this file along with the
 * two backend files noted above.
 */

export interface MockCatalogEntry {
  key: string;
  name: string;
  brand: string;
  category: string;
  summary: string;
  overallStatus: string;
}

export async function fetchMockCatalog(): Promise<MockCatalogEntry[]> {
  const res = await fetch(`${API_BASE}/public-check/catalog`);
  if (!res.ok) throw new Error('Could not load the placeholder product list.');
  return res.json();
}

export async function checkMockProduct(productKey: string): Promise<InspectionDetail> {
  const res = await fetch(`${API_BASE}/public-check/${encodeURIComponent(productKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...actorHeaders('CONSUMER') },
    body: JSON.stringify({})
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Could not run the placeholder check.' }));
    throw new Error(body.error || 'Could not run the placeholder check.');
  }

  return res.json();
}
