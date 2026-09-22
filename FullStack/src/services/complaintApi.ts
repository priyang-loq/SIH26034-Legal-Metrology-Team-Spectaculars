import { ComplaintCategory, ComplaintSummary } from '../types';
import { API_BASE, actorHeaders } from './authApi';

export interface ComplaintCategoryOption {
  id: ComplaintCategory;
  label: string;
}

export async function fetchComplaintCategories(): Promise<ComplaintCategoryOption[]> {
  const res = await fetch(`${API_BASE}/complaints/categories`);
  if (!res.ok) throw new Error('Could not load complaint categories.');
  return res.json();
}

export interface SubmitComplaintInput {
  inspectionId: string;
  category: ComplaintCategory;
  description: string;
  supportingInfo?: string;
  contact?: string;
}

export async function submitComplaint(input: SubmitComplaintInput): Promise<ComplaintSummary> {
  const res = await fetch(`${API_BASE}/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...actorHeaders('CONSUMER') },
    body: JSON.stringify(input)
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Could not submit the complaint.' }));
    throw new Error(body.error || 'Could not submit the complaint.');
  }

  return res.json();
}

export async function fetchComplaint(id: string): Promise<ComplaintSummary> {
  const res = await fetch(`${API_BASE}/complaints/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Complaint not found.');
  return res.json();
}
