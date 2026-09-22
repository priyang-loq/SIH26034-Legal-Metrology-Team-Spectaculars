import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, FileText, Loader2, AlertTriangle, CheckCircle2, XCircle,
  HelpCircle, MinusCircle, Printer, ShieldQuestion, Info
} from 'lucide-react';
import { ScanResult, FieldStatus } from '../../types';
import { fetchScanById } from '../../services/coverageApi';
import { fetchRuleCoverage, RuleCoverageInfo } from '../../services/coverageApi';

interface ProductComplianceDocumentProps {
  scanId: string;
  onBack: () => void;
}

const STATUS_META: Record<FieldStatus, { label: string; icon: React.ReactNode; className: string }> = {
  FOUND: {
    label: 'Found',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    className: 'bg-[#E7F5EC] text-[#1B7A43] border-[#1B7A43]/30'
  },
  NOT_FOUND: {
    label: 'Not Found',
    icon: <XCircle className="w-3.5 h-3.5" />,
    className: 'bg-[#FCEAE8] text-[#B42318] border-[#B42318]/30'
  },
  LOW_CONFIDENCE: {
    label: 'Low Confidence',
    icon: <HelpCircle className="w-3.5 h-3.5" />,
    className: 'bg-[#FDF3D8] text-[#B45309] border-[#B45309]/30'
  },
  AI_UNAVAILABLE: {
    label: 'AI Unavailable',
    icon: <ShieldQuestion className="w-3.5 h-3.5" />,
    className: 'bg-[#EAF0FB] text-[#2C5AA0] border-[#2C5AA0]/30'
  },
  NOT_APPLICABLE: {
    label: 'Not Applicable',
    icon: <MinusCircle className="w-3.5 h-3.5" />,
    className: 'bg-[#EEF2F8] text-[#5B6B84] border-[#D6DEEA]'
  }
};

export const ProductComplianceDocument: React.FC<ProductComplianceDocumentProps> = ({ scanId, onBack }) => {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [coverage, setCoverage] = useState<RuleCoverageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchScanById(scanId), fetchRuleCoverage().catch(() => null)])
      .then(([scanData, coverageData]) => {
        if (cancelled) return;
        setScan(scanData);
        setCoverage(coverageData);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load this compliance document.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [scanId]);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-5 print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#5B6B84] hover:text-[#14224A]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        {scan && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#14224A] text-white hover:bg-[#14224A]/90"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save as PDF
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-[#5B6B84] py-20">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading compliance document...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-[#FCEAE8] border border-[#B42318]/30 text-[#B42318] text-sm rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {scan && (
        <div className="bg-white rounded-xl border border-[#D6DEEA] overflow-hidden">
          {/* Document header */}
          <div className="bg-[#14224A] text-white px-6 py-5">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-wider text-[#B9C4DA]">
              <FileText className="w-3.5 h-3.5" />
              COMPLIANCE DOCUMENT &middot; {scan.id}
            </div>
            <h1 className="text-xl font-bold mt-1">{scan.productTitle}</h1>
            <p className="text-sm text-[#B9C4DA] mt-1">
              {scan.brand || 'Unknown Brand'} &middot; {scan.category} &middot; {new Date(scan.timestamp).toLocaleString()}
            </p>
          </div>

          {/* Summary */}
          <div className="px-6 py-5 border-b border-[#D6DEEA] flex flex-wrap items-center gap-4">
            <span className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${
              scan.overallStatus === 'COMPLIANT' ? 'bg-[#E7F5EC] text-[#1B7A43] border-[#1B7A43]/30'
              : scan.overallStatus === 'NON_COMPLIANT' ? 'bg-[#FCEAE8] text-[#B42318] border-[#B42318]/30'
              : 'bg-[#FDF3D8] text-[#B45309] border-[#B45309]/30'
            }`}>
              {scan.overallStatus.replace('_', ' ')}
            </span>
            <span className="text-sm text-[#5B6B84]">Compliance Score: <strong className="text-[#14224A]">{scan.complianceScore}/100</strong></span>
            <span className="text-sm text-[#5B6B84]">Estimated Fine Exposure: <strong className="text-[#14224A]">{scan.estimatedStatutoryFine}</strong></span>
            {scan.categoryExemptionApplied && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-[#EAF0FB] text-[#2C5AA0] border border-[#2C5AA0]/30">
                <Info className="w-3 h-3" />
                "{scan.categoryExemptionApplied}" category exemptions applied
              </span>
            )}
          </div>

          {/* Field-by-field breakdown */}
          <div className="px-6 py-5 border-b border-[#D6DEEA]">
            <h2 className="text-sm font-bold text-[#14224A] mb-3">Mandatory Declaration Checklist</h2>
            <div className="space-y-2">
              {scan.checkedFields.map((f, i) => {
                const status = f.status || (f.isPresent && !f.isMalformed ? 'FOUND' : f.isPresent ? 'LOW_CONFIDENCE' : 'NOT_FOUND');
                const meta = STATUS_META[status];
                return (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 p-3 rounded-lg bg-[#EEF2F8]">
                    <span className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border whitespace-nowrap ${meta.className}`}>
                      {meta.icon}
                      {meta.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#14224A]">{f.fieldName} <span className="text-[#8B99B0] font-normal font-mono text-[11px]">({f.ruleReference})</span></p>
                      <p className="text-xs text-[#5B6B84] mt-0.5">{f.explanation}</p>
                      {f.detectedText && (
                        <p className="text-[11px] font-mono text-[#8B99B0] mt-1 break-words">Detected: "{f.detectedText}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Violations */}
          {scan.violations.length > 0 && (
            <div className="px-6 py-5 border-b border-[#D6DEEA]">
              <h2 className="text-sm font-bold text-[#14224A] mb-3">Violated Statutory Clauses</h2>
              <div className="space-y-3">
                {scan.violations.map((v, i) => (
                  <div key={i} className="p-3 rounded-lg border border-[#D6DEEA]">
                    <p className="text-sm font-bold text-[#14224A]">{v.clauseId} - {v.clauseTitle}</p>
                    <p className="text-xs text-[#5B6B84] mt-1">{v.violationReason}</p>
                    <p className="text-[11px] font-mono text-[#8B99B0] mt-1">{v.statutoryAct} - {v.penaltySection}</p>
                    <p className="text-xs text-[#5B6B84] mt-1">Penalty: {v.penaltyDescription}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Honest rule-coverage notes */}
          {coverage && (
            <div className="px-6 py-5 bg-[#EEF2F8]">
              <h2 className="text-sm font-bold text-[#14224A] mb-1">System Coverage Notes</h2>
              <p className="text-xs text-[#5B6B84] mb-3">
                What this system checks, what it exempts, and what's deliberately out of scope for this result.
              </p>

              {coverage.deferred.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] font-bold text-[#8B99B0] uppercase tracking-wide mb-1.5">Deliberately Deferred</p>
                  <ul className="space-y-1.5">
                    {coverage.deferred.map((d, i) => (
                      <li key={i} className="text-xs text-[#5B6B84]">
                        <strong className="text-[#14224A]">{d.title}:</strong> {d.note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {coverage.unverified.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-[#8B99B0] uppercase tracking-wide mb-1.5">Implemented, Not Yet Verified</p>
                  <ul className="space-y-1.5">
                    {coverage.unverified.map((d, i) => (
                      <li key={i} className="text-xs text-[#5B6B84]">
                        <strong className="text-[#14224A]">{d.title}:</strong> {d.note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
