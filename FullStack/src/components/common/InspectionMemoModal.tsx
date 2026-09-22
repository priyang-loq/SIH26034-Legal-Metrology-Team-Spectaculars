import React, { useState } from 'react';
import { X, Printer, Copy, Check, ShieldAlert, FileCheck, Download } from 'lucide-react';
import { ScanResult } from '../../types';
import { StampBadge } from './StampBadge';

interface InspectionMemoModalProps {
  scan: ScanResult | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InspectionMemoModal: React.FC<InspectionMemoModalProps> = ({
  scan,
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !scan) return null;

  const handleCopyMemo = () => {
    const memoText = `
GOVERNMENT OF INDIA
LEGAL METROLOGY ENFORCEMENT WING
FORM A - STATUTORY INSPECTION & SEIZURE NOTICE (RULE 29)
=========================================================
Memo Reference: ${scan.inspectionMemoNumber || 'LMPC/ENF/2026/AUTO-GEN'}
Date of Audit: ${new Date(scan.timestamp).toLocaleString('en-IN')}
Inspected Commodity: ${scan.productTitle}
Brand / Packer: ${scan.brand}
Category: ${scan.category}
Batch / Barcode: ${scan.batchNumber || 'N/A'} / ${scan.barcode || 'N/A'}

COMPLIANCE VERDICT: ${scan.overallStatus} (Score: ${scan.complianceScore}/100)
ESTIMATED STATUTORY FINE: ${scan.estimatedStatutoryFine}

STATUTORY VIOLATIONS DETECTED UNDER LEGAL METROLOGY ACT, 2009:
${scan.violations.map((v, i) => `
${i + 1}. [${v.clauseId}] - ${v.clauseTitle}
   Statutory Act: ${v.statutoryAct}
   Defect Detected: ${v.description}
   Detected Text Snippet: "${v.detectedSnippet || 'Omitted from principal panel'}"
   Mandatory Standard: ${v.mandatoryRequirement}
   Applicable Penalty: ${v.penaltyDescription}
   Remediation: ${v.remediationAdvice}
`).join('')}

INSPECTOR NOTES:
${scan.inspectorNotes || 'Verified via Automated Legal Metrology AI Engine (SIH26034).'}

ISSUED BY:
Legal Metrology Inspector / Authorized Officer
Department of Consumer Affairs, Legal Metrology Wing
=========================================================
`;
    navigator.clipboard.writeText(memoText.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[#EEF2F8] border-2 border-[#14224A] rounded-xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Control Bar */}
        <div className="bg-[#14224A] text-[#F3F6FB] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-[#B45309]" />
            <span className="font-mono text-sm font-semibold tracking-wider">
              OFFICIAL STATUTORY INSPECTION NOTICE (FORM-A)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMemo}
              className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-[#F3F6FB] text-xs font-mono rounded transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#1B7A43]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Notice'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#1B7A43] hover:bg-[#1B7A43]/90 text-white text-xs font-mono rounded transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Memo</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-[#8B99B0] hover:text-[#F3F6FB] transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Ledger Content */}
        <div className="p-8 overflow-y-auto blueprint-grid space-y-6 text-[#14224A]">
          {/* Header of Official Notice */}
          <div className="border-b-2 border-double border-[#14224A] pb-4 text-center relative">
            <div className="absolute right-0 top-0 hidden sm:block">
              <StampBadge
                status={scan.overallStatus}
                size="md"
                rotation={-8}
              />
            </div>
            <p className="text-[10px] font-mono tracking-widest text-[#5B6B84] uppercase">
              GOVERNMENT OF INDIA • DEPARTMENT OF CONSUMER AFFAIRS
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold font-heading text-[#14224A] tracking-tight mt-1">
              OFFICE OF THE CONTROLLER OF LEGAL METROLOGY
            </h2>
            <p className="text-xs font-mono text-[#5B6B84]">
              Inspection & Seizure Notice under Section 18 / 36 of Legal Metrology Act, 2009
            </p>
            <div className="mt-3 inline-block px-3 py-1 bg-[#E3E9F2] text-[#14224A] font-mono text-xs font-bold border border-[#D6DEEA]">
              MEMO REF NO: {scan.inspectionMemoNumber || 'LMPC/ENF/WZ/2026/08491'}
            </div>
          </div>

          {/* Commodity Details Ledger Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-lg border border-[#D6DEEA] text-xs font-mono">
            <div>
              <span className="text-[#5B6B84] block text-[10px]">COMMODITY NAME</span>
              <strong className="text-[#14224A] font-sans">{scan.productTitle}</strong>
            </div>
            <div>
              <span className="text-[#5B6B84] block text-[10px]">MANUFACTURER/BRAND</span>
              <strong className="text-[#14224A]">{scan.brand}</strong>
            </div>
            <div>
              <span className="text-[#5B6B84] block text-[10px]">CATEGORY</span>
              <span className="text-[#14224A]">{scan.category}</span>
            </div>
            <div>
              <span className="text-[#5B6B84] block text-[10px]">AUDIT TIMESTAMP</span>
              <span className="text-[#14224A]">{new Date(scan.timestamp).toLocaleDateString('en-IN')}</span>
            </div>
          </div>

          {/* Section: Statutory Violations */}
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-[#D6DEEA] pb-1">
              <h3 className="font-heading font-bold text-sm text-[#14224A] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#B42318]" />
                FLAGGED STATUTORY INFRACTIONS ({scan.violations.length})
              </h3>
              <span className="text-xs font-mono font-bold text-[#B42318]">
                {scan.estimatedStatutoryFine}
              </span>
            </div>

            {scan.violations.length === 0 ? (
              <div className="p-4 bg-[#E7F5EC] rounded-lg border border-[#1B7A43] text-xs text-[#1B7A43] font-mono">
                ✓ No violations detected. The package fulfills all statutory provisions under Rule 6 of the Legal Metrology (Packaged Commodities) Rules, 2011.
              </div>
            ) : (
              <div className="space-y-3">
                {scan.violations.map((v, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-[#B42318]/30 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-bold text-[#B42318] bg-[#FCEAE8] px-2 py-0.5 rounded border border-[#B42318]/20">
                        {v.clauseId} : {v.clauseTitle}
                      </span>
                      <span className="text-[10px] font-mono text-[#5B6B84]">
                        {v.penaltySection}
                      </span>
                    </div>
                    <p className="text-[#14224A] font-medium mt-1">
                      {v.violationReason}
                    </p>
                    {v.detectedSnippet && (
                      <div className="mt-1.5 p-2 bg-[#EEF2F8] rounded font-mono text-[11px] text-[#5B6B84]">
                        <span className="text-[#B42318] font-semibold">Detected Non-Compliant Text: </span>
                        "{v.detectedSnippet}"
                      </div>
                    )}
                    <div className="mt-2 text-[11px] text-[#1B7A43] font-mono">
                      <strong>Mandatory Standard: </strong>{v.mandatoryRequirement}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inspector Remarks */}
          <div className="p-4 bg-white rounded-lg border border-[#D6DEEA] text-xs">
            <span className="font-bold text-[#14224A] block mb-1 font-mono uppercase text-[11px]">
              Inspecting Authority Observations:
            </span>
            <p className="text-[#5B6B84] italic">
              {scan.inspectorNotes || 'Label scrutinized against statutory requirements under Legal Metrology Act, 2009 and Packaged Commodities Rules, 2011.'}
            </p>
          </div>

          {/* Signature & Seal Footer */}
          <div className="pt-4 border-t border-[#D6DEEA] flex flex-col sm:flex-row items-center justify-between text-xs text-[#5B6B84] font-mono gap-4">
            <div>
              <p className="text-[10px]">System Generated under Legal Metrology Automated Audit Platform (SIH26034)</p>
              <p className="text-[10px]">Ministry of Consumer Affairs, Government of India</p>
            </div>
            <div className="text-right border-t sm:border-t-0 border-[#14224A] pt-2 sm:pt-0">
              <p className="font-bold text-[#14224A]">AUTHORIZED INSPECTOR</p>
              <p className="text-[10px]">Legal Metrology Enforcement Wing</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="bg-[#E3E9F2] px-6 py-3 border-t border-[#D6DEEA] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#14224A] text-[#F3F6FB] text-xs font-semibold rounded hover:bg-[#14224A]/90"
          >
            Close Notice
          </button>
        </div>
      </div>
    </div>
  );
};
