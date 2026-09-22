import React, { useEffect, useState } from 'react';
import { X, Loader2, AlertTriangle, UserCheck, PackageSearch } from 'lucide-react';
import { ComplaintStatus } from '../../types';
import { fetchAuthorityComplaint, updateComplaint } from '../../services/authorityApi';
import { ComplaintStatusPill, PriorityBadge, ComplianceStatusPill } from '../common/StatusIndicators';
import { ComplianceGrid } from '../common/ComplianceGrid';

const STATUS_FLOW: ComplaintStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'ACTION_TAKEN', 'RESOLVED'];

interface Props {
  complaintId: string;
  onClose: () => void;
  onChanged?: () => void;
}

/**
 * Shows the full chain the spec asks for:
 * Scanned product -> Compliance result -> Consumer complaint -> Authority review -> Action / Resolution
 */
export const ComplaintDetailPanel: React.FC<Props> = ({ complaintId, onClose, onChanged }) => {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAuthorityComplaint>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAuthorityComplaint(complaintId)
      .then((res) => {
        setData(res);
        setNotes(res.authorityNotes || '');
      })
      .catch((err) => setError(err.message || 'Could not load this complaint.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaintId]);

  const apply = async (payload: Parameters<typeof updateComplaint>[1]) => {
    setSaving(true);
    setError(null);
    try {
      await updateComplaint(complaintId, payload);
      load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this complaint.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-[#F3F6FB] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#D6DEEA] bg-[#14224A] px-5 py-4 text-white">
          <div>
            <p className="font-mono text-[10px] tracking-wider text-[#B9C4DA]">COMPLAINT DETAIL</p>
            <h3 className="text-sm font-bold">{complaintId}</h3>
          </div>
          <button onClick={onClose} className="text-[#B9C4DA] hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[#5B6B84]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : !data ? (
          <div className="p-6 text-sm text-[#B42318]">{error || 'Complaint not found.'}</div>
        ) : (
          <div className="space-y-5 p-5">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-[#B42318]/30 bg-[#FCEAE8] px-3 py-2 text-xs text-[#B42318]">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
              </div>
            )}

            <div className="rounded-xl border border-[#D6DEEA] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <ComplaintStatusPill status={data.status} />
                <PriorityBadge priority={data.priority} />
                {data.isDemo && (
                  <span className="rounded border border-[#B45309]/30 bg-[#FDF3D8] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#8A4A08]">
                    SAMPLE
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-lg font-bold text-[#14224A]">{data.categoryLabel || data.category}</h2>
              <p className="font-mono text-xs text-[#5B6B84]">
                {data.productName || 'Unknown product'} ┬╖ Submitted {new Date(data.createdAt).toLocaleString()}
              </p>
              <p className="mt-3 rounded-lg bg-[#F7F9FC] px-3 py-2 text-sm text-[#14224A]">{data.description}</p>
            </div>

            {/* Chain: scanned product -> compliance result -> complaint -> review */}
            {data.inspection && (
              <div className="rounded-xl border border-[#D6DEEA] bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <PackageSearch className="h-4 w-4 text-[#14224A]" />
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#14224A]">
                    Linked package inspection
                  </h4>
                  <ComplianceStatusPill status={data.inspection.complianceStatus} />
                </div>
                <ComplianceGrid findings={data.inspection.findings} priority={data.inspection.priority} dense />
              </div>
            )}

            <div className="rounded-xl border border-[#D6DEEA] bg-white p-4">
              <h4 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-[#14224A]">
                Submitted ΓåÆ Under Review ΓåÆ Action Taken ΓåÆ Resolved
              </h4>
              <div className="flex flex-wrap gap-2">
                {STATUS_FLOW.map((s) => (
                  <button
                    key={s}
                    disabled={saving || data.status === s}
                    onClick={() => apply({ status: s })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      data.status === s
                        ? 'border-[#14224A] bg-[#14224A] text-white'
                        : 'border-[#D6DEEA] bg-white text-[#5B6B84] hover:bg-[#EEF2F8]'
                    }`}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <button
                  disabled={saving}
                  onClick={() => apply({ assignTo: 'me' })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6DEEA] bg-white px-3 py-1.5 text-xs font-semibold text-[#14224A] hover:bg-[#EEF2F8] disabled:opacity-50"
                >
                  <UserCheck className="h-3.5 w-3.5" /> Assign to me
                </button>
                {data.assignedAuthorityName && (
                  <span className="ml-2 text-xs text-[#5B6B84]">Currently: {data.assignedAuthorityName}</span>
                )}
              </div>

              <div className="mt-4">
                <label className="mb-1 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5B6B84]">
                  Authority notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="w-full resize-y rounded-lg border border-[#D6DEEA] bg-[#F7F9FC] px-3 py-2 text-sm text-[#14224A] outline-none focus:border-[#14224A] focus:bg-white"
                />
                <button
                  disabled={saving}
                  onClick={() => apply({ notes })}
                  className="mt-2 rounded-lg bg-[#14224A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1c2f63] disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save note'}
                </button>
              </div>
            </div>

            {data.events && data.events.length > 0 && (
              <div className="rounded-xl border border-[#D6DEEA] bg-white p-4">
                <h4 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-[#14224A]">
                  Status history
                </h4>
                <ul className="space-y-2">
                  {data.events.map((e) => (
                    <li key={e.id} className="text-xs text-[#5B6B84]">
                      <span className="font-mono text-[10px] text-[#8B99B0]">
                        {new Date(e.timestamp).toLocaleString()}
                      </span>{' '}
                      ΓÇö {e.fromStatus ? `${e.fromStatus} ΓåÆ ` : ''}
                      <strong className="text-[#14224A]">{e.toStatus}</strong>
                      {e.actedBy ? ` by ${e.actedBy}` : ''}
                      {e.notes ? `: ${e.notes}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
