import React from 'react';
import { ClauseStatistic } from '../../types';
import { AlertTriangle, ChevronRight, Info, BookOpen, ShieldAlert } from 'lucide-react';

interface ViolatedClausesTableProps {
  clauses: ClauseStatistic[];
  selectedClauseFilter: string;
  onSelectClause: (clauseId: string) => void;
  onOpenRulebookWithClause: (clauseId: string) => void;
}

export const ViolatedClausesTable: React.FC<ViolatedClausesTableProps> = ({
  clauses,
  selectedClauseFilter,
  onSelectClause,
  onOpenRulebookWithClause
}) => {
  return (
    <div className="bg-white rounded-xl border border-[#D6DEEA] p-5 shadow-xs flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#E3E9F2]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#B42318]" />
            <h3 className="font-heading font-bold text-base text-[#14224A]">
              Most-Violated Statutory Rule Clauses
            </h3>
          </div>
          <p className="text-xs text-[#5B6B84]">
            Ranked by total frequency of non-compliance across national packaged commodity audits
          </p>
        </div>
        {selectedClauseFilter !== 'all' && (
          <button
            onClick={() => onSelectClause('all')}
            className="text-xs font-mono text-[#B42318] underline hover:text-[#14224A] self-start"
          >
            Clear Clause Filter (Active: {selectedClauseFilter})
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-[#D6DEEA] bg-[#EEF2F8] text-[#5B6B84]">
              <th className="py-2.5 px-3 font-semibold">CLAUSE REF</th>
              <th className="py-2.5 px-3 font-semibold font-sans">MANDATORY REQUIREMENT</th>
              <th className="py-2.5 px-3 font-semibold">SECTOR / SCOPE</th>
              <th className="py-2.5 px-3 font-semibold text-right">TOTAL DETECTED</th>
              <th className="py-2.5 px-3 font-semibold text-right">SHARE %</th>
              <th className="py-2.5 px-3 font-semibold">SEVERITY</th>
              <th className="py-2.5 px-3 font-semibold text-center">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E9F2]">
            {clauses.map((clause) => {
              const isFiltered = selectedClauseFilter === clause.clauseId;
              const severityBg = 
                clause.severity === 'CRITICAL' ? 'bg-[#FCEAE8] text-[#B42318] border-[#B42318]/30' :
                clause.severity === 'HIGH' ? 'bg-[#FDF3D8] text-[#B45309] border-[#B45309]/30' :
                'bg-[#E3E9F2] text-[#5B6B84] border-[#D6DEEA]';

              return (
                <tr
                  key={clause.clauseId}
                  className={`hover:bg-[#EEF2F8] transition-colors cursor-pointer ${
                    isFiltered ? 'bg-[#FDF3D8] border-l-4 border-l-[#B45309]' : ''
                  }`}
                  onClick={() => onSelectClause(clause.clauseId)}
                >
                  {/* Clause Ref */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="font-bold text-[#14224A] bg-[#E3E9F2] px-2 py-0.5 rounded text-[11px]">
                      {clause.clauseId}
                    </span>
                  </td>

                  {/* Mandatory Requirement */}
                  <td className="py-3 px-3 font-sans">
                    <div className="font-bold text-[#14224A]">{clause.clauseTitle}</div>
                    <div className="text-[11px] text-[#5B6B84] mt-0.5 line-clamp-1">{clause.shortRule}</div>
                  </td>

                  {/* Sector / Scope */}
                  <td className="py-3 px-3 whitespace-nowrap text-[#5B6B84]">
                    {clause.category}
                  </td>

                  {/* Total Violations Count */}
                  <td className="py-3 px-3 text-right font-bold text-[#14224A]">
                    {clause.totalViolations.toLocaleString()}
                  </td>

                  {/* Violation Rate Progress Bar */}
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-[#E3E9F2] h-2 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="bg-[#B42318] h-full rounded-full"
                          style={{ width: `${Math.min(clause.violationPercentage * 2.2, 100)}%` }}
                        />
                      </div>
                      <span className="font-bold text-[#B42318]">{clause.violationPercentage}%</span>
                    </div>
                  </td>

                  {/* Severity Badge */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${severityBg}`}>
                      {clause.severity}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onSelectClause(clause.clauseId)}
                        title="Filter recent non-compliant scans by this clause"
                        className="px-2 py-1 bg-[#E3E9F2] hover:bg-[#14224A] hover:text-[#F3F6FB] text-[#14224A] rounded text-[10px] transition-colors"
                      >
                        Filter Scans
                      </button>
                      <button
                        onClick={() => onOpenRulebookWithClause(clause.clauseId)}
                        title="View Gazette statutory clause in Rules Handbook"
                        className="p-1 hover:bg-[#E3E9F2] text-[#1B7A43] rounded transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-3 border-t border-[#E3E9F2] flex flex-col sm:flex-row items-center justify-between text-xs text-[#5B6B84] font-mono gap-2">
        <span>Click any row to filter recent non-compliant audits in the ledger below</span>
        <span className="text-[#B42318] font-medium">Statutory Penalties under Section 36(1) apply to all flagged items</span>
      </div>
    </div>
  );
};
