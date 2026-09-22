import {
  ComplaintStatus,
  ComplaintSummary,
  FeedbackEntry,
  InspectionDetail,
  InspectionStatus,
  InspectionSummary,
  Priority,
  ScanResult
} from '../types';
import { API_BASE, authHeader, authorityLogout } from './authApi';
import { toQueryString } from './inspectionApi';

async function authorityFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}/authority${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...authHeader() }
  });

  if (res.status === 401) {
    // Session expired or invalid - clear it so the login screen shows again
    authorityLogout();
  }

  return res;
}

async function parse<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: fallback }));
    throw new Error(body.error || fallback);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Legacy scan queue (unchanged)
// ---------------------------------------------------------------------------

export interface AuthoritySummary {
  pending: number;
  underReview: number;
  noticesIssued: number;
  resolved: number;
}

export type ActionStatus = 'PENDING' | 'UNDER_REVIEW' | 'NOTICE_ISSUED' | 'RESOLVED';

export interface AuthorityScan extends ScanResult {
  submittedBy: string;
  actionStatus: ActionStatus;
  actionNotes?: string;
  reportPath?: string;
}

export async function fetchAuthoritySummary(): Promise<AuthoritySummary> {
  return parse(await authorityFetch('/summary'), 'Failed to load authority summary.');
}

export async function fetchViolationsQueue(status: ActionStatus | 'ALL' = 'ALL'): Promise<AuthorityScan[]> {
  return parse(await authorityFetch(`/violations?status=${status}`), 'Failed to load violations queue.');
}

export async function takeAction(scanId: string, action: ActionStatus, notes?: string): Promise<void> {
  const res = await authorityFetch(`/violations/${scanId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, notes })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update action status.' }));
    throw new Error(err.error);
  }
}

export function downloadReportUrl(scanId: string): string {
  return `${API_BASE}/authority/reports/${scanId}`;
}

export async function downloadReport(scanId: string, productTitle?: string): Promise<void> {
  const res = await authorityFetch(`/reports/${scanId}`);
  if (!res.ok) throw new Error('No report available for this scan.');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Compliance-Report-${productTitle || scanId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Inspections
// ---------------------------------------------------------------------------

export interface AuthorityInspectionQuery {
  actorType?: string;
  complianceStatus?: string;
  priority?: string;
  status?: string;
  assignedTo?: string;
  search?: string;
  from?: string;
  to?: string;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
}

export interface InspectionPage {
  total: number;
  page: number;
  limit: number;
  items: InspectionSummary[];
}

export async function fetchAuthorityInspections(query: AuthorityInspectionQuery = {}): Promise<InspectionPage> {
  return parse(await authorityFetch(`/inspections${toQueryString(query)}`), 'Failed to load inspections.');
}

export async function fetchAuthorityInspection(id: string): Promise<InspectionDetail> {
  return parse(await authorityFetch(`/inspections/${encodeURIComponent(id)}`), 'Inspection not found.');
}

export async function updateInspection(
  id: string,
  payload: { status?: InspectionStatus; priority?: Priority; notes?: string; assignTo?: string }
): Promise<InspectionDetail> {
  return parse(
    await authorityFetch(`/inspections/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
    'Could not update this inspection.'
  );
}

export interface Officer {
  id: string;
  name: string;
  designation?: string;
  district?: string;
  role: string;
}

export async function fetchOfficers(): Promise<Officer[]> {
  return parse(await authorityFetch('/officers'), 'Could not load officers.');
}

// ---------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------

export interface ComplaintPage {
  total: number;
  page: number;
  limit: number;
  items: ComplaintSummary[];
}

export async function fetchAuthorityComplaints(
  query: { status?: string; priority?: string; category?: string; search?: string; page?: number; limit?: number } = {}
): Promise<ComplaintPage> {
  return parse(await authorityFetch(`/complaints${toQueryString(query)}`), 'Failed to load complaints.');
}

export async function fetchAuthorityComplaint(
  id: string
): Promise<ComplaintSummary & { inspection: InspectionDetail | null }> {
  return parse(await authorityFetch(`/complaints/${encodeURIComponent(id)}`), 'Complaint not found.');
}

export async function updateComplaint(
  id: string,
  payload: { status?: ComplaintStatus; notes?: string; assignTo?: string }
): Promise<ComplaintSummary> {
  return parse(
    await authorityFetch(`/complaints/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
    'Could not update this complaint.'
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export interface FeedbackPage {
  total: number;
  page: number;
  limit: number;
  items: FeedbackEntry[];
  trend: Array<{ month: string; average: number; count: number }>;
}

export async function fetchAuthorityFeedback(
  query: { productId?: string; minRating?: number; maxRating?: number; page?: number; limit?: number } = {}
): Promise<FeedbackPage> {
  return parse(await authorityFetch(`/feedback${toQueryString(query)}`), 'Failed to load feedback.');
}

// ---------------------------------------------------------------------------
// Admin: authority authentication codes
// ---------------------------------------------------------------------------

export interface InviteCode {
  id: string;
  label?: string | null;
  designation?: string | null;
  district?: string | null;
  role: string;
  issuedByName?: string | null;
  expiresAt?: string | null;
  usedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  state: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
  code?: string;
  notice?: string;
}

async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}/admin${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...authHeader() }
  });
  if (res.status === 401) authorityLogout();
  return res;
}

export async function fetchInviteCodes(): Promise<InviteCode[]> {
  return parse(await adminFetch('/invite-codes'), 'Could not load authentication codes.');
}

export async function issueInviteCode(payload: {
  label?: string;
  designation?: string;
  district?: string;
  expiresInDays?: number;
}): Promise<InviteCode> {
  return parse(
    await adminFetch('/invite-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }),
    'Could not issue a code.'
  );
}

export async function revokeInviteCode(id: string): Promise<InviteCode> {
  return parse(
    await adminFetch(`/invite-codes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    'Could not revoke that code.'
  );
}
