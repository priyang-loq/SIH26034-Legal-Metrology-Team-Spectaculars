import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, AlertCircle, FileText, ExternalLink, Scale, Sparkles, Download } from 'lucide-react';
import { ScanResult, FieldComplianceResult, RuleClauseViolation } from '../../types';
import { StampBadge } from '../common/StampBadge';
import { submitScanReview } from '../../services/complianceApi';
import { downloadReport } from '../../services/authorityApi';

interface ScanDetailDrawerProps {
  scan: ScanResult | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerateNotice: (scan: ScanResult) => void;
  onOpenRulebookWithClause: (clauseId: string) => void;
  onOpenDocument?: (scanId: string) => void;
}

export const ScanDetailDrawer: React.FC<ScanDetailDrawerProps> = ({
  scan,
  isOpen,
  onClose,
  onGenerateNotice,
  onOpenRulebookWithClause,
  onOpenDocument
}) => {
  const [selectedField, setSelectedField] = useState<FieldComplianceResult | null>(null);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null);

  React.useEffect(() => {
    setCurrentScan(scan);
    setOverrides({});
  }, [scan]);

  const handleReviewSubmit = async () => {
    if (Object.keys(overrides).length === 0 || !currentScan) return;
    setIsSubmitting(true);
    try {
      const updatedScan = await submitScanReview(currentScan.id, overrides);
      setCurrentScan(updatedScan); // Update local scan state
      setOverrides({}); // Clear overrides after successful submit
    } catch (e: any) {
      alert(e.message || e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!currentScan) return;
    try {
      await downloadReport(currentScan.id, currentScan.productTitle);
    } catch (e: any) {
      alert(e.message || e);
    }
  };

  const handleCancel = () => {
    setOverrides({});
    onClose();
  };

  if (!isOpen || !currentScan) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        className="bg-[#EEF2F8] border-2 border-[#14224A] rounded-xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="bg-[#14224A] text-[#F3F6FB] px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-[#B42318] rounded text-white">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[#B45309] font-bold">CASE AUDIT: {currentScan.id}</span>
                <span className="text-white/40">•</span>
                <span className="text-xs font-mono text-[#8B99B0]">{currentScan.category}</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold font-heading text-white">
                {currentScan.productTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">

            {Object.keys(overrides).length > 0 && (
              <span className="text-yellow-400 text-xs font-mono font-bold px-2 animate-pulse">Unsaved changes!</span>
            )}
            {Object.keys(overrides).length > 0 && (
                <button
                onClick={handleReviewSubmit}
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white font-mono font-semibold rounded text-xs transition-colors flex items-center gap-1.5 shadow-lg"
              >
                <span>{isSubmitting ? 'Saving...' : 'Save / Submit Review'}</span>
              </button>
            )}
            <button
              onClick={() => onGenerateNotice(currentScan)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B42318] hover:bg-[#B42318]/90 text-white font-mono text-xs font-bold rounded transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Draft Sec 36 Notice</span>
            </button>
            <button
              onClick={handleCancel}
              className="p-1.5 rounded-lg text-[#8B99B0] hover:text-[#F3F6FB] hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="p-6 overflow-y-auto blueprint-grid flex-1 space-y-6">
          {/* Top Summary Banner */}
          <div className="bg-white p-4 rounded-xl border border-[#D6DEEA] flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <StampBadge
                status={currentScan.overallStatus}
                size="md"
                rotation={-4}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase text-[#5B6B84]">Compliance Verdict:</span>
                  <span className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded ${
                    currentScan.overallStatus === 'COMPLIANT' ? 'bg-[#E7F5EC] text-[#1B7A43]' : 'bg-[#FCEAE8] text-[#B42318]'
                  }`}>
                    {currentScan.overallStatus} ({currentScan.complianceScore}/100)
                  </span>
                </div>
                <div className="text-xs text-[#14224A] font-medium mt-1">
                  Brand / Packer: <strong>{currentScan.brand}</strong> | Pack Type: <strong>{currentScan.packType}</strong>
                </div>
                <div className="text-[11px] font-mono text-[#5B6B84] mt-0.5">
                  Batch: {currentScan.batchNumber || 'N/A'} | Barcode: {currentScan.barcode || 'N/A'}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 text-right w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0 border-[#E3E9F2]">
              <span className="text-[10px] font-mono text-[#5B6B84] uppercase">ESTIMATED STATUTORY PENALTY</span>
              <strong className="text-sm font-mono text-[#B42318] bg-[#FCEAE8] px-2.5 py-1 rounded border border-[#B42318]/20">
                {currentScan.estimatedStatutoryFine}
              </strong>
              <span className="text-[10px] text-[#5B6B84] font-mono">
                Audit Ref: {currentScan.inspectionMemoNumber || 'AUTO-AUDIT'}
              </span>
            </div>
          </div>

          {/* Main Inspection Workbench (2 Columns: Label Evidence & Checked Fields) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Visual Label Evidence with Bounding Boxes */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-[#14224A] uppercase">
                  PHOTOGRAPHIC EVIDENCE & OCR ANNOTATIONS
                </span>
                <button
                  onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                  className="text-[11px] font-mono text-[#1B7A43] underline hover:text-[#14224A]"
                >
                  {showBoundingBoxes ? 'Hide Overlays' : 'Show Overlays'}
                </button>
              </div>

              <div className="relative bg-black/90 rounded-xl overflow-hidden border-2 border-[#14224A] shadow-md flex items-center justify-center min-h-[320px]">
                <img
                  src={currentScan.imageUrl}
                  alt={currentScan.productTitle}
                  className="w-full h-auto max-h-[380px] object-contain"
                />

                {/* Bounding Box Overlays */}
                {showBoundingBoxes && currentScan.checkedFields.map((field) => {
                  if (!field.boundingBox) return null;
                  const box = field.boundingBox;
                  const isSelected = selectedField?.fieldId === field.fieldId;
                  const boxColor = box.isCompliant ? 'border-[#1B7A43] bg-[#1B7A43]/20' : 'border-[#B42318] bg-[#B42318]/25';

                  return (
                    <div
                      key={field.fieldId}
                      onClick={() => setSelectedField(field)}
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`,
                      }}
                      className={`absolute border-2 cursor-pointer transition-all ${boxColor} ${
                        isSelected ? 'ring-2 ring-yellow-400 scale-105 z-20' : 'z-10'
                      }`}
                    >
                      <span className={`absolute -top-5 left-0 text-[9px] font-mono font-bold px-1 py-0.2 rounded text-white whitespace-nowrap ${
                        box.isCompliant ? 'bg-[#1B7A43]' : 'bg-[#B42318]'
                      }`}>
                        {box.label}
                      </span>
                    </div>
                  );
                })}

                {/* Corner Calibrated Ticks */}
                <div className="absolute top-2 left-2 text-[8px] font-mono text-white/60 bg-black/60 px-1 rounded">
                  CALIBRATED OPTICAL INSPECTION
                </div>
              </div>

              <div className="p-3 bg-[#E3E9F2] rounded-lg border border-[#D6DEEA] text-[11px] font-mono text-[#5B6B84]">
                💡 <strong>Inspector Tip:</strong> Click any detected bounding box or rule in the right ledger to inspect extracted OCR text vs. legal requirement.
              </div>
            </div>

            {/* Right Column: 6 Mandatory Declarations Checklist */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-[#D6DEEA] pb-2">
                <h3 className="font-bold text-sm text-[#14224A] font-heading flex items-center gap-2">
                  <span>Mandatory Declaration Audit Ledger (Rule 6)</span>
                </h3>
                <span className="text-xs font-mono text-[#5B6B84]">
                  {currentScan.checkedFields.filter(f => f.isPresent && !f.isMalformed).length} of 6 Declarations Compliant
                </span>
              </div>

              <div className="p-3 bg-white border border-[#D6DEEA] rounded-lg flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-[#14224A] uppercase">Import Status Override</span>
                </div>
                <select
                  className="text-xs px-2 py-1 border border-[#D6DEEA] rounded font-mono text-[#14224A]"
                  value={overrides.import_status || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'DOMESTIC' || val === 'IMPORTED') {
                      setOverrides({...overrides, import_status: val});
                    } else {
                      const newOverrides = {...overrides};
                      delete newOverrides.import_status;
                      setOverrides(newOverrides);
                    }
                  }}
                >
                  <option value="">Select...</option>
                  <option value="DOMESTIC">DOMESTIC</option>
                  <option value="IMPORTED">IMPORTED</option>
                </select>
              </div>

              <div className="space-y-2.5">
                {currentScan.checkedFields.map((field) => {
                  const isPass = field.isPresent && !field.isMalformed;
                  const isSelected = selectedField?.fieldId === field.fieldId;

                  const isAiUnavailable = field.status === 'AI_UNAVAILABLE';
                  return (
                    <div
                      key={field.fieldId}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedField(selectedField?.fieldId === field.fieldId ? null : field);
                      }}
                      className={`p-3.5 rounded-lg border transition-all cursor-pointer bg-white ${
                        isSelected
                          ? 'border-[#14224A] ring-2 ring-[#14224A]/20 shadow-sm'
                          : isAiUnavailable
                          ? 'border-[#2C5AA0]/40 bg-[#EAF0FB]/30 hover:border-[#2C5AA0]'
                          : isPass
                          ? 'border-[#1B7A43]/30 hover:border-[#1B7A43]'
                          : 'border-[#B42318]/40 bg-[#FCEAE8]/40 hover:border-[#B42318]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isPass ? (
                            <CheckCircle2 className="w-4 h-4 text-[#1B7A43] shrink-0" />
                          ) : (
                            <AlertCircle className={`w-4 h-4 shrink-0 ${isAiUnavailable ? 'text-[#2C5AA0]' : 'text-[#B42318]'}`} />
                          )}
                          <strong className="text-xs text-[#14224A]">{field.fieldName}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenRulebookWithClause(field.ruleReference);
                            }}
                            className="text-[10px] font-mono text-[#1B7A43] hover:underline"
                          >
                            {field.ruleReference}
                          </button>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            isAiUnavailable
                              ? 'bg-[#EAF0FB] text-[#2C5AA0]'
                              : isPass
                              ? 'bg-[#E7F5EC] text-[#1B7A43]'
                              : 'bg-[#FCEAE8] text-[#B42318]'
                          }`}>
                            {isAiUnavailable ? 'AI UNAVAILABLE' : isPass ? 'PASS' : field.isPresent ? 'MALFORMED' : 'MISSING'}
                          </span>
                        </div>
                      </div>

                      {/* Explanation & Detected Text */}
                      <p className="text-xs text-[#5B6B84] mt-1.5 ml-6">
                        {field.explanation}
                      </p>

                      {isAiUnavailable && (
                        <div className="mt-2 ml-6 p-2 bg-[#EAF0FB] rounded text-[11px] font-mono text-[#2C5AA0] border border-[#2C5AA0]/30">
                          <span className="font-semibold block text-[9px] uppercase">AI unavailable — manual verification required</span>
                          Click to enter or correct this declaration manually.
                        </div>
                      )}


                      {field.detectedText && !field.officerOverride && (
                        <div className="mt-2 ml-6 p-2 bg-[#EEF2F8] rounded text-[11px] font-mono text-[#14224A] border border-[#E3E9F2]">
                          <span className="text-[#5B6B84] block text-[9px] uppercase font-semibold">Detected Text on Package:</span>
                          "{field.detectedText}"
                        </div>
                      )}
                      {field.officerOverride && (
                        <div className="mt-2 ml-6 p-2 bg-yellow-50 rounded text-[11px] font-mono text-yellow-900 border border-yellow-200">
                          <span className="text-yellow-700 block text-[9px] uppercase font-semibold">Officer Override (Effective):</span>
                          "{field.officerOverride}"
                          <span className="text-gray-400 block text-[9px] uppercase font-semibold mt-1">Original AI:</span>
                          <span className="line-through">"{field.originalText}"</span>
                        </div>
                      )}

                      {overrides[field.fieldId] !== undefined && !isSelected && (
                        <div className="mt-2 ml-6 p-2 bg-yellow-50 rounded text-[11px] font-mono text-yellow-900 border border-yellow-300">
                          <span className="text-yellow-700 block text-[9px] uppercase font-semibold">Unsaved Officer Edit:</span>
                          "{overrides[field.fieldId]}"
                        </div>
                      )}

                      {isSelected && (
                          <div className="mt-2 ml-6 flex gap-2">
                            <input
                              type="text"
                              placeholder="Enter override value..."
                              className="text-xs px-2 py-1 border border-gray-300 rounded w-full"
                              value={overrides[field.fieldId] !== undefined ? overrides[field.fieldId] : (field.detectedText || '')}
                              onChange={(e) => setOverrides({...overrides, [field.fieldId]: e.target.value})}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                      )}


                      {!isPass && (
                        <div className="mt-2 ml-6 text-[10px] font-mono text-[#B42318] font-medium">
                          Required Standard: {field.expectedFormat}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Statutory Violations & Remedies Section */}
              {currentScan.violations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#D6DEEA]">
                  <h4 className="font-bold text-xs font-mono text-[#B42318] uppercase mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Statutory Penal Sections Charged ({currentScan.violations.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {currentScan.violations.map((v, i) => (
                      <div key={i} className="p-3 bg-[#FCEAE8] rounded-lg border border-[#B42318]/30 text-xs">
                        <div className="flex items-center justify-between font-mono font-bold text-[#B42318] mb-1">
                          <span>{v.clauseId}: {v.clauseTitle}</span>
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-[#B42318]/20">{v.statutoryAct}</span>
                        </div>
                        <p className="text-[#14224A] text-[11px]">{v.violationReason}</p>
                        <div className="mt-1.5 text-[10px] font-mono text-[#5B6B84]">
                          <strong>Remediation: </strong>{v.remediationAdvice}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="bg-[#E3E9F2] px-6 py-3 border-t border-[#D6DEEA] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-[#5B6B84] font-mono text-[11px]">
            Audit memo generated under Legal Metrology Act, 2009 Standards
          </div>
          <div className="flex items-center gap-3">

            {Object.keys(overrides).length > 0 && (
              <span className="text-yellow-600 text-xs font-mono font-bold px-2 animate-pulse">Unsaved changes!</span>
            )}
            {Object.keys(overrides).length > 0 && (
                <button
                onClick={handleReviewSubmit}
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white font-mono font-semibold rounded text-xs transition-colors flex items-center gap-1.5 shadow-lg"
              >
                <span>{isSubmitting ? 'Saving...' : 'Save / Submit Review'}</span>
              </button>
            )}
            <button
              onClick={() => onGenerateNotice(currentScan)}
              className="px-4 py-1.5 bg-[#B42318] hover:bg-[#B42318]/90 text-white font-mono font-semibold rounded text-xs transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Generate Form-A Inspection Memo</span>
            </button>
            {onOpenDocument && currentScan.actionStatus === 'REVIEWED' && (
              <button
                onClick={() => { onOpenDocument(currentScan.id); onClose(); }}
                className="px-4 py-1.5 bg-white border border-[#D6DEEA] text-[#14224A] hover:bg-[#EEF2F8] font-mono font-semibold rounded text-xs transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View Compliance Document</span>
              </button>
            )}
            {currentScan.actionStatus === 'REVIEWED' && (
              <button
                onClick={handleDownload}
                className="px-4 py-1.5 bg-[#14224A] hover:bg-[#14224A]/90 text-white font-mono font-semibold rounded text-xs transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Compliance PDF</span>
              </button>
            )}

            <button
              onClick={handleCancel}
              className="px-4 py-1.5 bg-[#14224A] text-[#F3F6FB] font-semibold rounded text-xs hover:bg-[#14224A]/90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
