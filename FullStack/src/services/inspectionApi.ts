import { InspectionDetail, InspectionSummary } from '../types';
import { API_BASE, actorHeaders } from './authApi';

export interface InspectionQuery {
  status?: string;
  priority?: string;
  complianceStatus?: string;
  actorType?: string;
  search?: string;
  from?: string;
  to?: string;
  sort?: 'priority' | 'date';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface InspectionPage {
  total: number;
  page: number;
  limit: number;
  items: InspectionSummary[];
}

export function toQueryString(query: object = {}): string {
  const params = new URLSearchParams();
  Object.entries(query as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'ALL') return;
    params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** History for the current browser only (consumer or seller). */
export async function fetchMyInspections(
  type: 'CONSUMER' | 'SELLER',
  query: InspectionQuery = {}
): Promise<InspectionPage> {
  const res = await fetch(`${API_BASE}/inspections${toQueryString(query)}`, {
    headers: actorHeaders(type)
  });
  if (!res.ok) throw new Error('Could not load your inspection history.');
  return res.json();
}

export async function fetchInspection(id: string): Promise<InspectionDetail> {
  const res = await fetch(`${API_BASE}/inspections/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Could not load that inspection.');
  return res.json();
}
