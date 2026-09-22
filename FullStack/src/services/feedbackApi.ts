import { FeedbackSummary } from '../types';
import { API_BASE, actorHeaders } from './authApi';

export interface SubmitFeedbackInput {
  inspectionId?: string;
  productId?: string;
  rating: number;
  qualityRating?: number | null;
  packagingRating?: number | null;
  labelClarityRating?: number | null;
  overallRating?: number | null;
  reviewText?: string;
  displayName?: string;
}

export async function submitFeedback(
  input: SubmitFeedbackInput
): Promise<{ id: string; message: string; summary: FeedbackSummary }> {
  const res = await fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...actorHeaders('CONSUMER') },
    body: JSON.stringify(input)
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Could not submit feedback.' }));
    throw new Error(body.error || 'Could not submit feedback.');
  }

  return res.json();
}

export async function fetchFeedbackForInspection(inspectionId: string): Promise<FeedbackSummary> {
  const res = await fetch(`${API_BASE}/feedback/inspection/${encodeURIComponent(inspectionId)}`);
  if (!res.ok) throw new Error('Could not load ratings for this product.');
  return res.json();
}

export async function fetchFeedbackForProduct(productId: string): Promise<FeedbackSummary> {
  const res = await fetch(`${API_BASE}/feedback/product/${encodeURIComponent(productId)}`);
  if (!res.ok) throw new Error('Could not load ratings for this product.');
  return res.json();
}
