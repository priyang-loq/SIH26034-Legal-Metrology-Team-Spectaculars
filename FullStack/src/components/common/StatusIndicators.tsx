import React from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Circle, MinusCircle, ShieldQuestion, Star, StarHalf
} from 'lucide-react';
import { FindingResult, InspectionStatus, Priority, ComplaintStatus } from '../../types';

/**
 * Shared status vocabulary for the whole application, so a HIGH priority badge
 * or a "Resolved" pill looks and reads the same on every screen.
 */

const RESULT_META: Record<FindingResult, { label: string; symbol: string; className: string; icon: React.ReactNode }> = {
  COMPLIANT: {
    label: 'Compliant',
    symbol: 'Γ£ô',
    className: 'bg-[#E7F5EC] text-[#1B7A43] border-[#1B7A43]/30',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />
  },
  NON_COMPLIANT: {
    label: 'Non-compliant',
    symbol: 'Γ£ò',
    className: 'bg-[#FCEAE8] text-[#B42318] border-[#B42318]/30',
    icon: <XCircle className="w-3.5 h-3.5" />
  },
  WARNING: {
    label: 'Warning',
    symbol: 'ΓÜá',
    className: 'bg-[#FDF3D8] text-[#B45309] border-[#B45309]/30',
    icon: <AlertTriangle className="w-3.5 h-3.5" />
  },
  PENDING: {
    label: 'Pending review',
    symbol: 'ΓùÅ',
    className: 'bg-[#EAF0FB] text-[#2C5AA0] border-[#2C5AA0]/30',
    icon: <ShieldQuestion className="w-3.5 h-3.5" />
  },
  NOT_APPLICABLE: {
    label: 'Not applicable',
    symbol: 'ΓÇô',
    className: 'bg-[#EEF2F8] text-[#5B6B84] border-[#D6DEEA]',
    icon: <MinusCircle className="w-3.5 h-3.5" />
  }
};

export const ResultBadge: React.FC<{ result: FindingResult; compact?: boolean }> = ({ result, compact }) => {
  const meta = RESULT_META[result] || RESULT_META.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${meta.className}`}
      title={meta.label}
    >
      {meta.icon}
      {!compact && meta.label}
    </span>
  );
};

const PRIORITY_META: Record<Priority, string> = {
  HIGH: 'bg-[#FCEAE8] text-[#B42318] border-[#B42318]/40',
  MEDIUM: 'bg-[#FDF3D8] text-[#8A4A08] border-[#B45309]/40',
  LOW: 'bg-[#EEF2F8] text-[#5B6B84] border-[#D6DEEA]'
};

export const PriorityBadge: React.FC<{ priority?: Priority | null; title?: string }> = ({ priority, title }) => {
  if (!priority) return <span className="text-xs text-[#8B99B0]">ΓÇô</span>;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide ${PRIORITY_META[priority]}`}
      title={title}
    >
      <span className="text-[13px] leading-none">ΓÇó</span>
      {priority}
    </span>
  );
};

const INSPECTION_STATUS_META: Record<InspectionStatus, { label: string; className: string }> = {
  DETECTED: { label: 'Detected', className: 'bg-[#EEF2F8] text-[#5B6B84] border-[#D6DEEA]' },
  PRIORITIZED: { label: 'Prioritised', className: 'bg-[#EAF0FB] text-[#2C5AA0] border-[#2C5AA0]/30' },
  UNDER_REVIEW: { label: 'Under review', className: 'bg-[#FDF3D8] text-[#8A4A08] border-[#B45309]/30' },
  ACTION_REQUIRED: { label: 'Action required', className: 'bg-[#FCEAE8] text-[#B42318] border-[#B42318]/30' },
  RESOLVED: { label: 'Resolved', className: 'bg-[#E7F5EC] text-[#1B7A43] border-[#1B7A43]/30' }
};

export const InspectionStatusPill: React.FC<{ status?: InspectionStatus | null }> = ({ status }) => {
  const meta = (status && INSPECTION_STATUS_META[status]) || INSPECTION_STATUS_META.DETECTED;
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
};

const COMPLAINT_STATUS_META: Record<ComplaintStatus, { label: string; className: string }> = {
  SUBMITTED: { label: 'Submitted', className: 'bg-[#EAF0FB] text-[#2C5AA0] border-[#2C5AA0]/30' },
  UNDER_REVIEW: { label: 'Under review', className: 'bg-[#FDF3D8] text-[#8A4A08] border-[#B45309]/30' },
  ACTION_TAKEN: { label: 'Action taken', className: 'bg-[#EDE9FB] text-[#4C3A9E] border-[#4C3A9E]/30' },
  RESOLVED: { label: 'Resolved', className: 'bg-[#E7F5EC] text-[#1B7A43] border-[#1B7A43]/30' }
};

export const ComplaintStatusPill: React.FC<{ status?: ComplaintStatus | null }> = ({ status }) => {
  const meta = (status && COMPLAINT_STATUS_META[status]) || COMPLAINT_STATUS_META.SUBMITTED;
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
};

const COMPLIANCE_STATUS_META: Record<string, string> = {
  COMPLIANT: 'bg-[#E7F5EC] text-[#1B7A43] border-[#1B7A43]/30',
  NON_COMPLIANT: 'bg-[#FCEAE8] text-[#B42318] border-[#B42318]/30',
  NEEDS_REVIEW: 'bg-[#FDF3D8] text-[#8A4A08] border-[#B45309]/30',
  FLAGGED_REVIEW: 'bg-[#FDF3D8] text-[#8A4A08] border-[#B45309]/30'
};

export const ComplianceStatusPill: React.FC<{ status?: string | null }> = ({ status }) => {
  if (!status) return <span className="text-xs text-[#8B99B0]">ΓÇô</span>;
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${
        COMPLIANCE_STATUS_META[status] || 'bg-[#EEF2F8] text-[#5B6B84] border-[#D6DEEA]'
      }`}
    >
      {status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
};

/** Read-only star display supporting half stars. */
export const StarDisplay: React.FC<{ value: number; size?: number; showValue?: boolean }> = ({
  value,
  size = 16,
  showValue
}) => {
  const stars = [1, 2, 3, 4, 5].map((i) => {
    const filled = value >= i;
    const half = !filled && value >= i - 0.5;
    const style = { width: size, height: size };
    if (filled) return <Star key={i} style={style} className="fill-[#B45309] text-[#B45309]" />;
    if (half) return <StarHalf key={i} style={style} className="fill-[#B45309] text-[#B45309]" />;
    return <Star key={i} style={style} className="text-[#C7D0DF]" />;
  });

  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-0.5">{stars}</span>
      {showValue && <span className="font-mono text-xs text-[#5B6B84]">{value.toFixed(1)}</span>}
    </span>
  );
};

/** Interactive star input with half-star granularity. */
export const StarInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  size?: number;
  label?: string;
}> = ({ value, onChange, size = 28, label }) => {
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label={label || 'Star rating'}
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = shown >= i;
          const half = !filled && shown >= i - 0.5;
          return (
            <span key={i} className="relative" style={{ width: size, height: size }}>
              {/* left half = i - 0.5, right half = i */}
              <button
                type="button"
                aria-label={`${i - 0.5} stars`}
                className="absolute left-0 top-0 z-10 h-full w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(i - 0.5)}
                onClick={() => onChange(i - 0.5)}
              />
              <button
                type="button"
                aria-label={`${i} stars`}
                className="absolute right-0 top-0 z-10 h-full w-1/2 cursor-pointer"
                onMouseEnter={() => setHover(i)}
                onClick={() => onChange(i)}
              />
              {filled ? (
                <Star style={{ width: size, height: size }} className="fill-[#B45309] text-[#B45309] transition-transform duration-150" />
              ) : half ? (
                <StarHalf style={{ width: size, height: size }} className="fill-[#B45309] text-[#B45309]" />
              ) : (
                <Star style={{ width: size, height: size }} className="text-[#C7D0DF]" />
              )}
            </span>
          );
        })}
      </div>
      <span className="font-mono text-sm font-semibold text-[#14224A]">
        {shown > 0 ? shown.toFixed(1) : '0.0'}
      </span>
    </div>
  );
};

export const EmptyState: React.FC<{ title: string; hint?: string; icon?: React.ReactNode }> = ({
  title,
  hint,
  icon
}) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#D6DEEA] bg-[#F7F9FC] px-6 py-10 text-center">
    <div className="text-[#8B99B0]">{icon || <Circle className="h-6 w-6" />}</div>
    <p className="text-sm font-semibold text-[#14224A]">{title}</p>
    {hint && <p className="max-w-md text-xs text-[#5B6B84]">{hint}</p>}
  </div>
);

export const DemoDataNotice: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`flex items-start gap-2 rounded-lg border border-[#B45309]/30 bg-[#FDF3D8] px-3 py-2 text-[11px] text-[#8A4A08] ${className}`}
  >
    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
    <span>
      <strong className="font-semibold">Demonstration data.</strong> This view contains seeded sample records with
      fictional products. These are prototype figures, not real enforcement statistics.
    </span>
  </div>
);

export { RESULT_META };
