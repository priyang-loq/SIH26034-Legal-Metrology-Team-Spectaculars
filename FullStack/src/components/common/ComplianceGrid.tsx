import React from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { InspectionFinding, Priority } from '../../types';
import { ResultBadge, PriorityBadge, EmptyState } from './StatusIndicators';

interface ComplianceGridProps {
  findings: InspectionFinding[];
  priority?: Priority | null;
  /** Optional per-issue action column, rendered by the authority portal only. */
  renderAction?: (finding: InspectionFinding) => React.ReactNode;
  statusLabel?: string;
  dense?: boolean;
}

/**
 * Splits one inspection into two readable tables instead of a single block:
 * what the package got right, and what it got wrong. Severity drives the
 * per-issue priority shown in the non-compliance table.
 */
export const ComplianceGrid: React.FC<ComplianceGridProps> = ({
  findings,
  priority,
  renderAction,
  statusLabel,
  dense
}) => {
  const compliant = findings.filter((f) => f.result === 'COMPLIANT');
  const notApplicable = findings.filter((f) => f.result === 'NOT_APPLICABLE');
  const issues = findings.filter(
    (f) => f.result === 'NON_COMPLIANT' || f.result === 'WARNING' || f.result === 'PENDING'
  );

  const severityToPriority = (severity?: string | null, result?: string): Priority => {
    if (result === 'WARNING' || result === 'PENDING') return severity === 'CRITICAL' ? 'MEDIUM' : 'LOW';
    if (severity === 'CRITICAL') return 'HIGH';
    if (severity === 'HIGH') return 'HIGH';
    if (severity === 'MEDIUM') return 'MEDIUM';
    return 'LOW';
  };

  const cell = dense ? 'px-3 py-2' : 'px-4 py-2.5';

  return (
    <div className="space-y-5">
      {/* COMPLIANCE ------------------------------------------------------ */}
      <section className="overflow-hidden rounded-lg border border-[#D6DEEA] bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-[#D6DEEA] bg-[#F3F6FB] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#1B7A43]" />
            <h3 className="font-mono text-xs font-bold tracking-wider text-[#14224A]">COMPLIANCE</h3>
          </div>
          <span className="font-mono text-[11px] text-[#5B6B84]">
            {compliant.length} of {findings.length - notApplicable.length} applicable requirements met
          </span>
        </header>

        {compliant.length === 0 ? (
          <div className="px-4 py-6">
            <EmptyState title="No requirement passed on this package." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5EAF2] font-mono text-[11px] uppercase tracking-wider text-[#8B99B0]">
                  <th className={`${cell} font-semibold`}>Requirement</th>
                  <th className={`${cell} w-36 font-semibold`}>Status</th>
                  <th className={`${cell} font-semibold`}>Description</th>
                </tr>
              </thead>
              <tbody>
                {compliant.map((f) => (
                  <tr key={f.id} className="border-b border-[#F0F3F8] last:border-0 hover:bg-[#F7F9FC]">
                    <td className={`${cell} align-top`}>
                      <span className="font-semibold text-[#14224A]">{f.fieldName}</span>
                      {f.ruleReference && (
                        <span className="ml-1.5 font-mono text-[11px] text-[#8B99B0]">{f.ruleReference}</span>
                      )}
                    </td>
                    <td className={`${cell} align-top`}>
                      <ResultBadge result={f.result} />
                    </td>
                    <td className={`${cell} align-top text-[#5B6B84]`}>{f.description || 'Correct'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* NON-COMPLIANCE -------------------------------------------------- */}
      <section className="overflow-hidden rounded-lg border border-[#D6DEEA] bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D6DEEA] bg-[#F3F6FB] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#B42318]" />
            <h3 className="font-mono text-xs font-bold tracking-wider text-[#14224A]">NON-COMPLIANCE</h3>
          </div>
          <div className="flex items-center gap-3">
            {priority && <PriorityBadge priority={priority} />}
            <span className="font-mono text-[11px] text-[#5B6B84]">{issues.length} issue(s)</span>
          </div>
        </header>

        {issues.length === 0 ? (
          <div className="px-4 py-6">
            <EmptyState
              title="No issues detected on this package."
              hint="Every applicable mandatory declaration was found and correctly formatted."
              icon={<CheckCircle2 className="h-6 w-6 text-[#1B7A43]" />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5EAF2] font-mono text-[11px] uppercase tracking-wider text-[#8B99B0]">
                  <th className={`${cell} font-semibold`}>Issue</th>
                  <th className={`${cell} w-28 font-semibold`}>Priority</th>
                  <th className={`${cell} font-semibold`}>Description</th>
                  <th className={`${cell} w-36 font-semibold`}>Status</th>
                  {renderAction && <th className={`${cell} w-40 font-semibold`}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {issues.map((f) => (
                  <tr key={f.id} className="border-b border-[#F0F3F8] last:border-0 hover:bg-[#FCFBF7]">
                    <td className={`${cell} align-top`}>
                      <span className="font-semibold text-[#14224A]">{f.fieldName}</span>
                      {f.ruleReference && (
                        <div className="font-mono text-[11px] text-[#8B99B0]">{f.ruleReference}</div>
                      )}
                    </td>
                    <td className={`${cell} align-top`}>
                      <PriorityBadge priority={severityToPriority(f.severity, f.result)} />
                    </td>
                    <td className={`${cell} align-top text-[#5B6B84]`}>{f.description}</td>
                    <td className={`${cell} align-top`}>
                      <ResultBadge result={f.result} />
                    </td>
                    {renderAction && <td className={`${cell} align-top`}>{renderAction(f)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {statusLabel && (
          <footer className="border-t border-[#E5EAF2] bg-[#F7F9FC] px-4 py-2 font-mono text-[11px] text-[#5B6B84]">
            {statusLabel}
          </footer>
        )}
      </section>

      {notApplicable.length > 0 && (
        <p className="font-mono text-[11px] text-[#8B99B0]">
          Not applicable for this category: {notApplicable.map((f) => f.fieldName).join(', ')}
        </p>
      )}
    </div>
  );
};
