import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Send, X } from 'lucide-react';
import { ComplaintCategory, ComplaintSummary } from '../../types';
import {
  fetchComplaintCategories,
  submitComplaint,
  ComplaintCategoryOption
} from '../../services/complaintApi';
import { ComplaintStatusPill } from '../common/StatusIndicators';

interface ComplaintFormProps {
  inspectionId: string;
  productName: string;
  onClose: () => void;
  onSubmitted?: (complaint: ComplaintSummary) => void;
}

const FALLBACK_CATEGORIES: ComplaintCategoryOption[] = [
  { id: 'INCORRECT_MRP', label: 'Incorrect price / MRP' },
  { id: 'MISSING_INFORMATION', label: 'Missing information' },
  { id: 'DAMAGED_PACKAGING', label: 'Damaged packaging' },
  { id: 'INCORRECT_QUANTITY', label: 'Incorrect quantity' },
  { id: 'EXPIRED_PRODUCT', label: 'Expired product' },
  { id: 'MISLEADING_INFORMATION', label: 'Misleading information' },
  { id: 'LABELLING_ISSUE', label: 'Labelling issue' },
  { id: 'OTHER', label: 'Other' }
];

/**
 * The product is never retyped: the complaint carries the inspection id, and
 * the backend derives the product and the compliance result from it.
 */
export const ComplaintForm: React.FC<ComplaintFormProps> = ({
  inspectionId,
  productName,
  onClose,
  onSubmitted
}) => {
  const [categories, setCategories] = useState<ComplaintCategoryOption[]>(FALLBACK_CATEGORIES);
  const [category, setCategory] = useState<ComplaintCategory>('INCORRECT_MRP');
  const [description, setDescription] = useState('');
  const [supportingInfo, setSupportingInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<ComplaintSummary | null>(null);

  useEffect(() => {
    fetchComplaintCategories()
      .then(setCategories)
      .catch(() => setCategories(FALLBACK_CATEGORIES));
  }, []);

  const handleSubmit = async () => {
    setError(null);

    if (description.trim().length < 10) {
      setError('Please describe the problem in at least 10 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const complaint = await submitComplaint({
        inspectionId,
        category,
        description: description.trim(),
        supportingInfo: supportingInfo.trim() || undefined
      });
      setSubmitted(complaint);
      onSubmitted?.(complaint);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-[#1B7A43]/30 bg-[#F4FBF6] p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#1B7A43]" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-[#14224A]">Complaint registered</h4>
            <p className="mt-1 text-xs text-[#5B6B84]">
              Reference <span className="font-mono font-semibold text-[#14224A]">{submitted.id}</span>. It is linked to
              this package inspection and is now visible to the reviewing authority.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ComplaintStatusPill status={submitted.status} />
              <span className="font-mono text-[11px] text-[#5B6B84]">
                Submitted → Under review → Action taken → Resolved
              </span>
            </div>
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
          <h4 className="text-sm font-bold text-[#14224A]">Report a complaint</h4>
          <p className="mt-0.5 text-xs text-[#5B6B84]">
            About <span className="font-semibold text-[#14224A]">{productName}</span>. The scanned package is attached
            automatically, so you do not need to enter product details again.
          </p>
        </div>
        <button onClick={onClose} className="text-[#8B99B0] hover:text-[#14224A]" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5B6B84]">
        Complaint category
      </label>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
              category === c.id
                ? 'border-[#14224A] bg-[#14224A] text-white'
                : 'border-[#D6DEEA] bg-[#F7F9FC] text-[#5B6B84] hover:border-[#B9C4DA] hover:text-[#14224A]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5B6B84]">
        What went wrong?
      </label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="Describe what you observed on the package or at the counter."
        className="w-full resize-y rounded-lg border border-[#D6DEEA] bg-[#F7F9FC] px-3 py-2 text-sm text-[#14224A] outline-none transition-colors focus:border-[#14224A] focus:bg-white"
      />
      <div className="mt-1 text-right font-mono text-[10px] text-[#8B99B0]">{description.length}/2000</div>

      <label className="mb-1.5 mt-2 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5B6B84]">
        Supporting information (optional)
      </label>
      <input
        value={supportingInfo}
        onChange={(e) => setSupportingInfo(e.target.value)}
        maxLength={500}
        placeholder="Shop name, purchase date, batch number, anything else useful."
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#14224A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1c2f63] disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Submit complaint
        </button>
      </div>
    </div>
  );
};
