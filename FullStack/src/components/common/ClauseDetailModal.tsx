import React from 'react';
import { X, BookOpen, AlertTriangle, ShieldCheck, Scale, FileText } from 'lucide-react';
import { LEGAL_METROLOGY_RULES_2011 } from '../../data/legalMetrologyRules';

interface ClauseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClauseId?: string;
}

export const ClauseDetailModal: React.FC<ClauseDetailModalProps> = ({
  isOpen,
  onClose,
  selectedClauseId
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[#EEF2F8] border-2 border-[#14224A] rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#14224A] text-[#F3F6FB] px-6 py-4 flex items-center justify-between border-b border-[#14224A]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#1B7A43] rounded-md text-white">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-heading">
                Legal Metrology (Packaged Commodities) Rules, 2011
              </h2>
              <p className="text-xs text-[#8B99B0] font-mono">
                Statutory Mandatory Declarations under Section 18 & 36 of Legal Metrology Act, 2009
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8B99B0] hover:text-[#F3F6FB] hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 ledger-lines">
          <div className="bg-[#E3E9F2] p-4 rounded-lg border border-[#D6DEEA] text-xs text-[#5B6B84] leading-relaxed">
            <strong className="text-[#14224A]">Statutory Framework Note:</strong> Under the Legal Metrology Act, 2009 (Act No. 1 of 2010), every pre-packaged commodity manufactured, packed, imported, or offered for sale in India must strictly adhere to the mandatory declarations prescribed under Rule 6 of the Packaged Commodities Rules, 2011. Non-compliance invites prosecution under Section 36(1).
          </div>

          <div className="grid grid-cols-1 gap-4">
            {LEGAL_METROLOGY_RULES_2011.map((rule) => {
              const isHighlighted = selectedClauseId && (
                rule.clause.toLowerCase().includes(selectedClauseId.toLowerCase()) || 
                rule.id === selectedClauseId
              );

              return (
                <div
                  key={rule.id}
                  className={`bg-white p-5 rounded-lg border transition-all ${
                    isHighlighted
                      ? 'border-[#B42318] ring-2 ring-[#B42318]/20 shadow-md'
                      : 'border-[#D6DEEA] hover:border-[#14224A]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-[#14224A] text-[#F3F6FB] text-xs font-mono font-bold rounded">
                        {rule.clause}
                      </span>
                      <h3 className="font-bold text-sm text-[#14224A] font-heading">
                        {rule.title}
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-[#B42318] bg-[#FCEAE8] px-2 py-0.5 rounded border border-[#B42318]/20">
                      {rule.penaltySection}
                    </span>
                  </div>

                  <p className="text-xs text-[#14224A] font-medium mb-3">
                    {rule.mandatoryRequirement}
                  </p>

                  {/* Statutory Text Quote */}
                  <div className="p-3 bg-[#EEF2F8] rounded border-l-2 border-[#1B7A43] text-xs text-[#5B6B84] italic mb-3 font-mono">
                    "{rule.exactStatutoryText}"
                  </div>

                  {/* Standard Formats vs Common Violations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#E7F5EC] p-2.5 rounded border border-[#1B7A43]/20">
                      <div className="flex items-center gap-1.5 font-semibold text-[#1B7A43] mb-1.5 font-mono">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Prescribed Standard Formats</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-[#14224A] text-[11px] font-mono">
                        {rule.standardFormats.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-[#FCEAE8] p-2.5 rounded border border-[#B42318]/20">
                      <div className="flex items-center gap-1.5 font-semibold text-[#B42318] mb-1.5 font-mono">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Common Flagged Violations</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-[#14224A] text-[11px]">
                        {rule.commonViolations.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#E3E9F2] px-6 py-3 border-t border-[#D6DEEA] flex items-center justify-between text-xs text-[#5B6B84]">
          <span className="font-mono">Reference: Ministry of Consumer Affairs Gazette Notifications (as amended 2022-2024)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#14224A] text-[#F3F6FB] font-semibold text-xs rounded hover:bg-[#14224A]/90 transition-colors"
          >
            Close Handbook
          </button>
        </div>
      </div>
    </div>
  );
};
