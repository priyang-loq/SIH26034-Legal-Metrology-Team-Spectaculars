import React, { useEffect, useState } from 'react';
import { PackageSearch, RefreshCw, Loader2, AlertTriangle, FlaskConical, ShieldAlert, Sparkles } from 'lucide-react';
import { InspectionDetail } from '../../types';
import { fetchMockCatalog, checkMockProduct, MockCatalogEntry } from '../../services/publicCheckApi';
import { ComplianceGrid } from '../common/ComplianceGrid';
import {
  PriorityBadge, InspectionStatusPill, ComplianceStatusPill
} from '../common/StatusIndicators';
import { ComplaintForm } from '../consumer/ComplaintForm';
import { FeedbackForm, ProductFeedbackPanel } from '../consumer/FeedbackPanel';

/**
 * A separate, public-facing dashboard: check a product, see the compliance
 * result, report a complaint, leave 0-5 star feedback. It reuses the same
 * complaint/feedback components and backend endpoints as the main Consumer
 * Scan tab, but its "check a product" step uses a placeholder result instead
 * of the real image scanner - see services/publicCheckApi.ts for exactly
 * where that swap happens later.
 */
export const PublicConsumerDashboard: React.FC = () => {
  const [catalog, setCatalog] = useState<MockCatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [checking, setChecking] = useState<string | null>(null);
  const [result, setResult] = useState<InspectionDetail | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [showComplaint, setShowComplaint] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRefreshKey, setFeedbackRefreshKey] = useState(0);

  useEffect(() => {
    fetchMockCatalog()
      .then(setCatalog)
      .catch((err) => setCatalogError(err.message || 'Could not load the product list.'))
      .finally(() => setCatalogLoading(false));
  }, []);

  const handleCheck = async (productKey: string) => {
    setChecking(productKey);
    setCheckError(null);
    setResult(null);
    setShowComplaint(false);
    setShowFeedback(false);
    try {
      const inspection = await checkMockProduct(productKey);
      setResult(inspection);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Could not check this product.');
    } finally {
      setChecking(null);
    }
  };

  const reset = () => {
    setResult(null);
    setShowComplaint(false);
    setShowFeedback(false);
    setFeedbackRefreshKey(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-[#D6DEEA] bg-[#EEF2F8] p-5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#14224A] px-2 py-0.5 font-mono text-xs font-bold text-[#F3F6FB]">
            PUBLIC CONSUMER DASHBOARD
          </span>
          <span className="font-mono text-xs text-[#5B6B84]">No login required</span>
        </div>
        <h2 className="mt-1.5 font-heading text-xl font-bold text-[#14224A] sm:text-2xl">
          Check a product, report an issue, leave a rating
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[#5B6B84]">
          Pick a product below to see its compliance result, then report a complaint or rate it. Everything you
          submit is stored and visible to the reviewing authority.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-[#B45309]/30 bg-[#FDF3D8] px-3 py-2.5 text-xs text-[#8A4A08]">
        <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>
          <strong className="font-semibold">Testing placeholder.</strong> The product list and compliance result
          below are sample data standing in for the real label scanner, which is being integrated separately. Once
          that's ready, this dashboard's "check a product" step switches to the real scanner with no other changes.
        </span>
      </div>

      {!result && (
        <div className="rounded-xl border border-[#D6DEEA] bg-white p-5">
          <h3 className="mb-3 text-sm font-bold text-[#14224A]">Choose a product to check</h3>

          {catalogLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[#5B6B84]">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading products...
            </div>
          ) : catalogError ? (
            <div className="flex items-center gap-2 rounded-lg border border-[#B42318]/30 bg-[#FCEAE8] px-3 py-2 text-xs text-[#B42318]">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> {catalogError}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handleCheck(p.key)}
                  disabled={checking !== null}
                  className="flex flex-col items-start gap-2 rounded-xl border border-[#D6DEEA] bg-[#F7F9FC] p-4 text-left transition-colors hover:border-[#14224A] hover:bg-[#EEF2F8] disabled:opacity-60"
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <PackageSearch className="h-4 w-4 text-[#14224A]" />
                    {checking === p.key && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#14224A]" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#14224A]">{p.name}</p>
                    <p className="font-mono text-[11px] text-[#8B99B0]">{p.brand} · {p.category}</p>
                  </div>
                  <p className="text-xs text-[#5B6B84]">{p.summary}</p>
                </button>
              ))}
            </div>
          )}

          {checkError && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#B42318]/30 bg-[#FCEAE8] px-3 py-2 text-xs text-[#B42318]">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> {checkError}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[#D6DEEA] bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <ComplianceStatusPill status={result.complianceStatus} />
              <InspectionStatusPill status={result.status} />
              <PriorityBadge priority={result.priority} title={result.priorityReason || undefined} />
              {!result.scanId && (
                <span className="inline-flex items-center gap-1 rounded border border-[#B45309]/30 bg-[#FDF3D8] px-2 py-0.5 font-mono text-[10px] font-bold text-[#8A4A08]">
                  <FlaskConical className="h-3 w-3" /> MOCK CHECK · NO IMAGE SCANNED
                </span>
              )}
            </div>
            <h3 className="mt-2 text-lg font-bold text-[#14224A]">{result.productName}</h3>
            <p className="font-mono text-xs text-[#5B6B84]">
              {result.brand || 'Unknown brand'} · {result.category || 'Uncategorized'}
            </p>

            <button
              onClick={reset}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#D6DEEA] bg-white px-3 py-1.5 text-xs font-semibold text-[#14224A] hover:bg-[#EEF2F8]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Check another product
            </button>
          </div>

          <ComplianceGrid findings={result.findings} priority={result.priority} />

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => {
                  setShowComplaint((v) => !v);
                  setShowFeedback(false);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-[#B42318]/40 bg-white px-4 py-2.5 text-xs font-bold text-[#B42318] hover:bg-[#FCEAE8]"
              >
                <ShieldAlert className="h-4 w-4" /> Report a Complaint
              </button>
              <button
                onClick={() => {
                  setShowFeedback((v) => !v);
                  setShowComplaint(false);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-[#B45309]/40 bg-white px-4 py-2.5 text-xs font-bold text-[#B45309] hover:bg-[#FDF3D8]"
              >
                <Sparkles className="h-4 w-4" /> ★ Give Feedback
              </button>
            </div>

            {showComplaint && (
              <ComplaintForm
                inspectionId={result.id}
                productName={result.productName}
                onClose={() => setShowComplaint(false)}
              />
            )}

            {showFeedback && (
              <FeedbackForm
                inspectionId={result.id}
                productName={result.productName}
                onClose={() => setShowFeedback(false)}
                onSubmitted={() => setFeedbackRefreshKey((k) => k + 1)}
              />
            )}

            <ProductFeedbackPanel inspectionId={result.id} refreshKey={feedbackRefreshKey} />
          </div>
        </div>
      )}
    </div>
  );
};
