import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert, LogOut, Loader2, AlertOctagon, MessageSquare,
  Search, KeyRound, ClipboardList, Star
} from 'lucide-react';
import { AuthorityUser, authorityLogout, isAdmin } from '../../services/authApi';
import {
  fetchAuthorityInspections, fetchAuthorityComplaints, fetchAuthorityFeedback,
  InspectionPage, ComplaintPage, FeedbackPage
} from '../../services/authorityApi';
import { InspectionSummary, ComplaintSummary, FeedbackEntry, Priority } from '../../types';
import {
  PriorityBadge, InspectionStatusPill, ComplianceStatusPill, ComplaintStatusPill, StarDisplay, DemoDataNotice, EmptyState
} from '../common/StatusIndicators';
import { InspectionDetailPanel } from './InspectionDetailPanel';
import { ComplaintDetailPanel } from './ComplaintDetailPanel';
import { AdminInviteCodes } from './AdminInviteCodes';

interface AuthorityPortalProps {
  user: AuthorityUser;
  onLogout: () => void;
  onOpenDocument?: (scanId: string) => void;
}

type Tab = 'inspections' | 'complaints' | 'feedback' | 'codes';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode; adminOnly?: boolean }> = [
  { id: 'inspections', label: 'Inspections', icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: 'complaints', label: 'Complaints', icon: <AlertOctagon className="w-3.5 h-3.5" /> },
  { id: 'feedback', label: 'Feedback', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { id: 'codes', label: 'Authentication Codes', icon: <KeyRound className="w-3.5 h-3.5" />, adminOnly: true }
];

export const AuthorityPortal: React.FC<AuthorityPortalProps> = ({ user, onLogout, onOpenDocument }) => {
  const [tab, setTab] = useState<Tab>('inspections');
  const admin = isAdmin(user);

  const handleLogout = () => {
    authorityLogout();
    onLogout();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#14224A] text-[#F3F6FB] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-[#B45309]/20 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-[#B45309]" />
          </div>
          <div>
            <p className="text-[10px] font-mono tracking-wider text-[#8B99B0]">
              PRIVATE &middot; AUTHORITY PORTAL {admin && '┬╖ ADMINISTRATOR'}
            </p>
            <h2 className="text-lg font-bold font-heading">Welcome, {user.name}</h2>
            {user.designation && <p className="text-xs text-[#8B99B0]">{user.designation}</p>}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#F3F6FB]/30 hover:bg-[#F3F6FB]/10 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#D6DEEA] pb-px">
        {TABS.filter((t) => !t.adminOnly || admin).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-[#14224A] text-[#14224A]'
                : 'border-transparent text-[#5B6B84] hover:text-[#14224A]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inspections' && <InspectionsTab onOpenDocument={onOpenDocument} />}
      {tab === 'complaints' && <ComplaintsTab />}
      {tab === 'feedback' && <FeedbackTab />}
      {tab === 'codes' && admin && <AdminInviteCodes />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Inspections tab
// ---------------------------------------------------------------------------

const PRIORITIES: Array<Priority | 'ALL'> = ['ALL', 'HIGH', 'MEDIUM', 'LOW'];
const COMPLIANCE_FILTERS = ['ALL', 'COMPLIANT', 'NON_COMPLIANT', 'NEEDS_REVIEW', 'FLAGGED_REVIEW'];

const InspectionsTab: React.FC<{ onOpenDocument?: (scanId: string) => void }> = ({ onOpenDocument }) => {
  const [page, setPage] = useState<InspectionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority | 'ALL'>('ALL');
  const [complianceStatus, setComplianceStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAuthorityInspections({ priority, complianceStatus, search: search || undefined, sort: 'priority', limit: 50 })
      .then(setPage)
      .catch((err) => setError(err.message || 'Failed to load inspections.'))
      .finally(() => setLoading(false));
  }, [priority, complianceStatus, search]);

  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  const hasDemo = page?.items.some((i) => i.isDemo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B99B0]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product, brand, barcode or inspection ID"
            className="w-full rounded-lg border border-[#D6DEEA] bg-white py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#14224A]/20"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                priority === p ? 'border-[#14224A] bg-[#14224A] text-white' : 'border-[#D6DEEA] bg-white text-[#5B6B84]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <select
          value={complianceStatus}
          onChange={(e) => setComplianceStatus(e.target.value)}
          className="rounded-lg border border-[#D6DEEA] bg-white px-2.5 py-2 text-xs text-[#14224A]"
        >
          {COMPLIANCE_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {hasDemo && <DemoDataNotice />}

      <div className="overflow-hidden rounded-xl border border-[#D6DEEA] bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-[#5B6B84]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading inspections...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-[#B42318]">{error}</div>
        ) : !page || page.items.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No inspections match these filters." icon={<ClipboardList className="h-6 w-6" />} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5EAF2] font-mono text-[11px] uppercase tracking-wider text-[#8B99B0]">
                  <th className="px-4 py-2.5 font-semibold">Product</th>
                  <th className="px-4 py-2.5 font-semibold">Source</th>
                  <th className="px-4 py-2.5 font-semibold">Compliance</th>
                  <th className="px-4 py-2.5 font-semibold">Priority</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Assigned</th>
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((i: InspectionSummary) => (
                  <tr
                    key={i.id}
                    onClick={() => setSelected(i.id)}
                    className="cursor-pointer border-b border-[#F0F3F8] last:border-0 hover:bg-[#F7F9FC]"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-[#14224A]">
                        {i.productName}
                        {i.isDemo && (
                          <span className="ml-1.5 rounded border border-[#B45309]/30 bg-[#FDF3D8] px-1 py-0.5 font-mono text-[9px] font-bold text-[#8A4A08]">
                            SAMPLE
                          </span>
                        )}
                        {!i.isDemo && !i.scanId && (
                          <span
                            className="ml-1.5 rounded border border-[#2C5AA0]/30 bg-[#EAF0FB] px-1 py-0.5 font-mono text-[9px] font-bold text-[#2C5AA0]"
                            title="Created from the Public Dashboard's placeholder check - no image was scanned"
                          >
                            MOCK CHECK
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8B99B0]">{i.brand || 'Unknown brand'}</div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#5B6B84]">
                      {i.actorType === 'SELLER' ? 'Seller' : 'Consumer'}
                      {(i.complaintCount || 0) > 0 && (
                        <div className="text-[#B45309]">{i.complaintCount} complaint(s)</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <ComplianceStatusPill status={i.complianceStatus} />
                    </td>
                    <td className="px-4 py-2.5">
                      <PriorityBadge priority={i.priority} title={i.priorityReason || undefined} />
                    </td>
                    <td className="px-4 py-2.5">
                      <InspectionStatusPill status={i.status} />
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-[#5B6B84]">{i.assignedAuthorityName || 'ΓÇö'}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#8B99B0]">
                      {new Date(i.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <InspectionDetailPanel
          inspectionId={selected}
          onClose={() => setSelected(null)}
          onChanged={load}
          onOpenDocument={onOpenDocument}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Complaints tab
// ---------------------------------------------------------------------------

const COMPLAINT_STATUSES = ['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'ACTION_TAKEN', 'RESOLVED'];

const ComplaintsTab: React.FC = () => {
  const [page, setPage] = useState<ComplaintPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAuthorityComplaints({ status, limit: 50 })
      .then(setPage)
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(load, [load]);

  const hasDemo = page?.items.some((c) => c.isDemo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {COMPLAINT_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              status === s ? 'border-[#14224A] bg-[#14224A] text-white' : 'border-[#D6DEEA] bg-white text-[#5B6B84]'
            }`}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {hasDemo && <DemoDataNotice />}

      <div className="overflow-hidden rounded-xl border border-[#D6DEEA] bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-[#5B6B84]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading complaints...
          </div>
        ) : !page || page.items.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No complaints in this category." icon={<AlertOctagon className="h-6 w-6" />} />
          </div>
        ) : (
          <div className="divide-y divide-[#F0F3F8]">
            {page.items.map((c: ComplaintSummary) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className="flex w-full flex-col gap-2 px-4 py-3.5 text-left hover:bg-[#F7F9FC] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#14224A]">{c.categoryLabel || c.category}</span>
                    <ComplaintStatusPill status={c.status} />
                    <PriorityBadge priority={c.priority} />
                    {c.isDemo && (
                      <span className="rounded border border-[#B45309]/30 bg-[#FDF3D8] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#8A4A08]">
                        SAMPLE
                      </span>
                    )}
                  </div>
                  <p className="mt-1 max-w-xl truncate text-xs text-[#5B6B84]">{c.description}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-[#8B99B0]">
                    {c.productName || 'Unknown product'} ┬╖ {new Date(c.createdAt).toLocaleString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ComplaintDetailPanel complaintId={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Feedback tab
// ---------------------------------------------------------------------------

const FeedbackTab: React.FC = () => {
  const [page, setPage] = useState<FeedbackPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAuthorityFeedback({ limit: 50 })
      .then(setPage)
      .finally(() => setLoading(false));
  }, []);

  const hasDemo = page?.items.some((f) => f.isDemo);

  return (
    <div className="space-y-4">
      {hasDemo && <DemoDataNotice />}

      {page && page.trend.length > 0 && (
        <div className="rounded-xl border border-[#D6DEEA] bg-white p-4">
          <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-[#14224A]">
            Average rating by month
          </h3>
          <div className="flex items-end gap-2 h-20">
            {page.trend.map((t) => (
              <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-[#B45309]/70"
                  style={{ height: `${Math.max(4, (t.average / 5) * 100)}%` }}
                  title={`${t.month}: ${t.average.toFixed(1)} (${t.count} reviews)`}
                />
                <span className="font-mono text-[9px] text-[#8B99B0]">{t.month.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#D6DEEA] bg-white">
        <header className="border-b border-[#D6DEEA] bg-[#F3F6FB] px-4 py-2.5">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#14224A]">
            Recent feedback {page ? `(${page.total})` : ''}
          </h3>
        </header>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-[#5B6B84]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading feedback...
          </div>
        ) : !page || page.items.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No consumer feedback yet." icon={<Star className="h-6 w-6" />} />
          </div>
        ) : (
          <ul className="divide-y divide-[#F0F3F8]">
            {page.items.map((f: FeedbackEntry) => (
              <li key={f.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StarDisplay value={f.rating} size={14} showValue />
                  <span className="text-xs font-semibold text-[#14224A]">{f.productName || 'Unknown product'}</span>
                  <span className="font-mono text-[10px] text-[#8B99B0]">
                    {new Date(f.createdAt).toLocaleDateString()}
                  </span>
                  {f.isDemo && (
                    <span className="rounded border border-[#B45309]/30 bg-[#FDF3D8] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#8A4A08]">
                      SAMPLE
                    </span>
                  )}
                </div>
                {f.reviewText && <p className="mt-1 text-xs text-[#5B6B84]">{f.reviewText}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
