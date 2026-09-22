import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MessageSquare, Star, X } from 'lucide-react';
import { FeedbackSummary } from '../../types';
import { fetchFeedbackForInspection, submitFeedback } from '../../services/feedbackApi';
import { StarDisplay, StarInput, EmptyState } from '../common/StatusIndicators';

interface FeedbackFormProps {
  inspectionId: string;
  productName: string;
  onClose: () => void;
  onSubmitted?: (summary: FeedbackSummary) => void;
}

const CATEGORY_FIELDS: Array<{ key: 'qualityRating' | 'packagingRating' | 'labelClarityRating' | 'overallRating'; label: string }> = [
  { key: 'qualityRating', label: 'Product quality' },
  { key: 'packagingRating', label: 'Packaging' },
  { key: 'labelClarityRating', label: 'Label clarity' },
  { key: 'overallRating', label: 'Overall experience' }
];

/** Open to any consumer after a scan. No login required. */
export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  inspectionId,
  productName,
  onClose,
  onSubmitted
}) => {
  const [rating, setRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({});
  const [reviewText, setReviewText] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (rating <= 0) {
      setError('Please choose a star rating first.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitFeedback({
        inspectionId,
        rating,
        qualityRating: categoryRatings.qualityRating ?? null,
        packagingRating: categoryRatings.packagingRating ?? null,
        labelClarityRating: categoryRatings.labelClarityRating ?? null,
        overallRating: categoryRatings.overallRating ?? null,
        reviewText: reviewText.trim() || undefined,
        displayName: displayName.trim() || undefined
      });
      setDone(true);
      onSubmitted?.(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-[#1B7A43]/30 bg-[#F4FBF6] p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#1B7A43]" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-[#14224A]">Thank you for the feedback</h4>
            <p className="mt-1 text-xs text-[#5B6B84]">
              Your rating is now part of this product's public score and is visible to the reviewing authority.
            </p>
          </div>
          <button onClick={onClose} className="text-[#8B99B0] hover:text-[#14224A]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#D6DEEA] bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-[#14224A]">Give feedback</h4>
          <p className="mt-0.5 text-xs text-[#5B6B84]">
            Rate <span className="font-semibold text-[#14224A]">{productName}</span>. Open to everyone, no account
            needed.
          </p>
        </div>
        <button onClick={onClose} className="text-[#8B99B0] hover:text-[#14224A]" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-lg border border-[#D6DEEA] bg-[#F7F9FC] px-4 py-3">
        <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5B6B84]">
          Overall rating
        </p>
        <StarInput value={rating} onChange={setRating} label="Overall rating" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CATEGORY_FIELDS.map((f) => (
          <div key={f.key} className="rounded-lg border border-[#E5EAF2] px-3 py-2.5">
            <p className="mb-1.5 text-xs font-semibold text-[#14224A]">{f.label}</p>
            <StarInput
              size={20}
              value={categoryRatings[f.key] || 0}
              onChange={(value) => setCategoryRatings((prev) => ({ ...prev, [f.key]: value }))}
              label={f.label}
            />
          </div>
        ))}
      </div>

      <label className="mb-1.5 mt-4 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5B6B84]">
        Written review (optional)
      </label>
      <textarea
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
        rows={3}
        maxLength={1500}
        placeholder="What was good or bad about this package?"
        className="w-full resize-y rounded-lg border border-[#D6DEEA] bg-[#F7F9FC] px-3 py-2 text-sm text-[#14224A] outline-none transition-colors focus:border-[#14224A] focus:bg-white"
      />

      <label className="mb-1.5 mt-3 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5B6B84]">
        Display name (optional)
      </label>
      <input
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        maxLength={60}
        placeholder="Leave blank to stay anonymous"
        className="w-full rounded-lg border border-[#D6DEEA] bg-[#F7F9FC] px-3 py-2 text-sm text-[#14224A] outline-none transition-colors focus:border-[#14224A] focus:bg-white"
      />

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#B42318]/30 bg-[#FCEAE8] px-3 py-2 text-xs text-[#B42318]">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-xs font-semibold text-[#5B6B84] hover:text-[#14224A]"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#B45309] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#95450a] disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
          Submit feedback
        </button>
      </div>
    </div>
  );
};

/**
 * Public rating panel shown under the scan result: average, count,
 * distribution and recent reviews. No consumer identity beyond a chosen
 * display name is ever shown.
 */
export const ProductFeedbackPanel: React.FC<{
  inspectionId: string;
  refreshKey?: number;
}> = ({ inspectionId, refreshKey = 0 }) => {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFeedbackForInspection(inspectionId)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inspectionId, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#D6DEEA] bg-white px-4 py-6 text-sm text-[#5B6B84]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading ratings...
      </div>
    );
  }

  if (!summary || summary.count === 0) {
    return (
      <div className="rounded-xl border border-[#D6DEEA] bg-white p-5">
        <h4 className="mb-3 text-sm font-bold text-[#14224A]">Consumer ratings</h4>
        <EmptyState
          title="No ratings yet for this product."
          hint="Be the first to rate it using the Give Feedback button above."
          icon={<MessageSquare className="h-6 w-6" />}
        />
      </div>
    );
  }

  const distributionCounts = Object.values(summary.distribution).map((v) => Number(v) || 0);
  const max = Math.max(1, ...distributionCounts);

  return (
    <div className="rounded-xl border border-[#D6DEEA] bg-white p-5">
      <h4 className="mb-4 text-sm font-bold text-[#14224A]">Consumer ratings</h4>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="text-center sm:w-40">
          <div className="font-mono text-4xl font-bold text-[#14224A]">{summary.average.toFixed(1)}</div>
          <div className="mt-1 flex justify-center">
            <StarDisplay value={summary.average} />
          </div>
          <div className="mt-1 text-[11px] text-[#5B6B84]">
            {summary.count} rating{summary.count === 1 ? '' : 's'}
          </div>
        </div>

        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution[String(star)] || 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="w-8 font-mono text-[11px] text-[#5B6B84]">{star}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEF2F8]">
                  <div
                    className="h-full rounded-full bg-[#B45309] transition-all duration-500"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right font-mono text-[11px] text-[#8B99B0]">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Quality', value: summary.categoryAverages.quality },
          { label: 'Packaging', value: summary.categoryAverages.packaging },
          { label: 'Label clarity', value: summary.categoryAverages.labelClarity },
          { label: 'Overall', value: summary.categoryAverages.overall }
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-[#E5EAF2] bg-[#F7F9FC] px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#8B99B0]">{c.label}</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-[#14224A]">
              {c.value != null ? c.value.toFixed(1) : '–'}
            </p>
          </div>
        ))}
      </div>

      {summary.recent.length > 0 && (
        <div className="mt-5 border-t border-[#E5EAF2] pt-4">
          <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5B6B84]">
            Recent reviews
          </p>
          <ul className="space-y-3">
            {summary.recent.slice(0, 5).map((r) => (
              <li key={r.id} className="rounded-lg bg-[#F7F9FC] px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StarDisplay value={r.rating} size={13} />
                  <span className="text-xs font-semibold text-[#14224A]">{r.displayName || 'Anonymous consumer'}</span>
                  <span className="font-mono text-[10px] text-[#8B99B0]">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                  {r.isDemo && (
                    <span className="rounded border border-[#B45309]/30 bg-[#FDF3D8] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#8A4A08]">
                      SAMPLE
                    </span>
                  )}
                </div>
                {r.reviewText && <p className="mt-1 text-xs text-[#5B6B84]">{r.reviewText}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
