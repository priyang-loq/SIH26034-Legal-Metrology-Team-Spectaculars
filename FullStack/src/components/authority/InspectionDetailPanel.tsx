import React, { useEffect, useState } from 'react';
import { ShieldAlert, X, Loader2, FileDown, UserCheck, AlertTriangle, ExternalLink } from 'lucide-react';
import { InspectionDetail, InspectionStatus, Priority, ScanResult } from '../../types';
import {
  fetchAuthorityInspection, updateInspection, downloadReport, fetchOfficers, Officer
} from '../../services/authorityApi';
import {
  InspectionStatusPill, PriorityBadge, ComplianceStatusPill, ComplaintStatusPill
} from '../common/StatusIndicators';
import { ComplianceGrid } from '../common/ComplianceGrid';
import { ScanDetailDrawer } from '../regulator/ScanDetailDrawer';

const STATUS_FLOW: InspectionStatus[] = ['DETECTED', 'PRIORITIZED', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED'];
const PRIORITIES: Priority[] = ['HIGH', 'MEDIUM', 'LOW'];

interface Props {
  inspectionId: string;
  onClose: () => void;
  onChanged?: () => void;
  onOpenDocument?: (scanId: string) => void;
}

export const InspectionDetailPanel: React.FC<Props> = ({ inspectionId, onClose, onChanged, onOpenDocument }) => {
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  const [reviewScan, setReviewScan] = useState<ScanResult | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);

  const openOfficerReview = async () => {
    if (!inspection?.scanId) return;
    setLoadingReview(true);
    try {
      const { fetchScanById } = await import('../../services/coverageApi');
      const scan = await fetchScanById(inspection.scanId);
      setReviewScan(scan);
    } catch (err: any) {
      setError(err.message || 'Could not load the original scan evidence.');
    } finally {
      setLoadingReview(false);
    }
  };


  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchAuthorityInspection(inspectionId), fetchOfficers().catch(() => [])])
      .then(([insp, off]) => {
        setInspection(insp);
        setOfficers(off);
        setNotes(insp.authorityNotes || '');
      })
      .catch((err) => setError(err.message || 'Could not load this inspection.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId]);

  const apply = async (payload: Parameters<typeof updateInspection>[1]) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateInspection(inspectionId, payload);
      setInspection(updated);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this inspection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-[#F3F6FB] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#D6DEEA] bg-[#14224A] px-5 py-4 text-white">
          <div>
            <p className="font-mono text-[10px] tracking-wider text-[#B9C4DA]">INSPECTION DETAIL</p>
            <h3 className="text-sm font-bold">{inspectionId}</h3>
          </div>
          <button onClick={onClose} className="text-[#B9C4DA] hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[#5B6B84]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : !inspection ? (
          <div className="p-6 text-sm text-[#B42318]">{error || 'Inspection not found.'}</div>
        ) : (
          (() => {
            const scanId = inspection.scanId;
            return (
          <div className="space-y-5 p-5">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-[#B42318]/30 bg-[#FCEAE8] px-3 py-2 text-xs text-[#B42318]">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
              </div>
            )}

            <div className="rounded-xl border border-[#D6DEEA] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <ComplianceStatusPill status={inspection.complianceStatus} />
                <InspectionStatusPill status={inspection.status} />
                <PriorityBadge priority={inspection.priority} title={inspection.priorityReason || undefined} />
                {inspection.isDemo && (
                  <span className="rounded border border-[#B45309]/30 bg-[#FDF3D8] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#8A4A08]">
                    SAMPLE
                  </span>
                )}
                {!inspection.isDemo && !inspection.scanId && (
                  <span
                    className="rounded border border-[#2C5AA0]/30 bg-[#EAF0FB] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#2C5AA0]"
                    title="Created from the Public Dashboard's placeholder check - no image was scanned"
                  >
                    MOCK CHECK
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-lg font-bold text-[#14224A]">{inspection.productName}</h2>
              <p className="font-mono text-xs text-[#5B6B84]">
                {inspection.brand || 'Unknown brand'} · {inspection.category || 'Uncategorized'} ·{' '}
                {inspection.actorType === 'SELLER' ? 'Seller self-check' : 'Consumer scan'} ·{' '}
                {new Date(inspection.createdAt).toLocaleString()}
              </p>
              {inspection.priorityReason && (
                <p className="mt-2 rounded-lg bg-[#F7F9FC] px-3 py-2 text-xs text-[#5B6B84]">
                  <strong className="text-[#14224A]">Why this priority: </strong>
                  {inspection.priorityReason}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {scanId && (
                  <button
                    onClick={openOfficerReview}
                    disabled={loadingReview}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6DEEA] bg-[#14224A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1c2f63] disabled:opacity-50"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {loadingReview ? 'Loading...' : 'Inspect Evidence / Officer Review'}
                  </button>
                )}
                {scanId && (
                  <button
                    onClick={() => downloadReport(scanId, inspection.productName)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6DEEA] bg-white px-3 py-1.5 text-xs font-semibold text-[#14224A] hover:bg-[#EEF2F8]"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Download report
                  </button>
                )}
                {onOpenDocument && scanId && (
                  <button
                    onClick={() => onOpenDocument(scanId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6DEEA] bg-white px-3 py-1.5 text-xs font-semibold text-[#14224A] hover:bg-[#EEF2F8]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Full compliance document
                  </button>
                )}
              </div>
            </div>

            <ComplianceGrid
              findings={inspection.findings}
              priority={inspection.priority}
              statusLabel={`Inspection status: ${inspection.status.replace(/_/g, ' ')}`}
              dense
            />

            {/* Lifecycle controls */}
            <div className="rounded-xl border border-[#D6DEEA] bg-white p-4">
              <h4 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-[#14224A]">
                Detected → Prioritized → Under Review → Action Required → Resolved
              </h4>
              <div className="flex flex-wrap gap-2">
                {STATUS_FLOW.map((s) => (
                  <button
                    key={s}
                    disabled={saving || inspection.status === s}
                    onClick={() => apply({ status: s })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      inspection.status === s
                        ? 'border-[#14224A] bg-[#14224A] text-white'
                        : 'border-[#D6DEEA] bg-white text-[#5B6B84] hover:bg-[#EEF2F8]'
                    }`}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5B6B84]">
                  Override priority:
                </span>
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    disabled={saving || inspection.priority === p}
                    onClick={() => apply({ priority: p })}
                    className="disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PriorityBadge priority={p} />
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label className="mb-1 block font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5B6B84]">
                  Assign
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    disabled={saving}
                    onClick={() => apply({ assignTo: 'me' })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6DEEA] bg-white px-3 py-1.5 text-xs font-semibold text-[#14224A] hover:bg-[#EEF2F8] disabled:opacity-50"
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Assign to me
                  </button>
                  <select
                    disabled={saving}
                    value={inspection.assignedAuthorityId || ''}
                    onChange={(e) => apply({ assignTo: e.target.value || undefined })}
                    className="rounded-lg border border-[#D6DEEA] bg-white px-2.5 py-1.5 text-xs text-[#14224A] disabled:opacity-50"
                  >
                    <option value="">Unassigned</option>
                    {officers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  {inspection.assignedAuthorityName && (
                    <span className="text-xs text-[#5B6B84]">Currently: {inspection.assignedAuthorityName}</span>
                  )}
                </div>
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

            {inspection.complaints.length > 0 && (
              <div className="rounded-xl border border-[#D6DEEA] bg-white p-4">
                <h4 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-[#14224A]">
                  Linked complaints ({inspection.complaints.length})
                </h4>
                <ul className="space-y-2">
                  {inspection.complaints.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#F7F9FC] px-3 py-2 text-xs">
                      <div>
                        <span className="font-semibold text-[#14224A]">{c.categoryLabel || c.category}</span>
                        <span className="ml-2 text-[#8B99B0]">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <ComplaintStatusPill status={c.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {inspection.events.length > 0 && (
              <div className="rounded-xl border border-[#D6DEEA] bg-white p-4">
                <h4 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-[#14224A]">
                  Status history
                </h4>
                <ul className="space-y-2">
                  {inspection.events.map((e) => (
                    <li key={e.id} className="text-xs text-[#5B6B84]">
                      <span className="font-mono text-[10px] text-[#8B99B0]">
                        {new Date(e.timestamp).toLocaleString()}
                      </span>{' '}
                      — {e.fromStatus ? `${e.fromStatus} → ` : ''}
                      <strong className="text-[#14224A]">{e.toStatus}</strong>
                      {e.actedBy ? ` by ${e.actedBy}` : ''}
                      {e.notes ? `: ${e.notes}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
            );
          })()
        )}
      </div>
      {reviewScan && (
        <ScanDetailDrawer
          scan={reviewScan}
          isOpen={!!reviewScan}
          onClose={() => {
            setReviewScan(null);
            onChanged?.();
          }}
          onGenerateNotice={() => {}}
          onOpenRulebookWithClause={() => {}}
        />
      )}
    </div>
  );
};



