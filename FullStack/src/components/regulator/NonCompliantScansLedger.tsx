import React from 'react';
import { ScanResult, FilterState } from '../../types';
import { Search, Filter, AlertTriangle, Eye, FileText, ChevronRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { StampBadge } from '../common/StampBadge';

interface NonCompliantScansLedgerProps {
  scans: ScanResult[];
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onSelectScan: (scan: ScanResult) => void;
  onGenerateNotice: (scan: ScanResult) => void;
}

export const NonCompliantScansLedger: React.FC<NonCompliantScansLedgerProps> = ({
  scans,
  filters,
  onFilterChange,
  onSelectScan,
  onGenerateNotice
}) => {
  // Apply filtering
  const filteredScans = scans.filter((scan) => {
    // Search query
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      const matchTitle = scan.productTitle.toLowerCase().includes(q);
      const matchBrand = scan.brand.toLowerCase().includes(q);
      const matchCategory = scan.category.toLowerCase().includes(q);
      const matchId = scan.id.toLowerCase().includes(q);
      if (!matchTitle && !matchBrand && !matchCategory && !matchId) return false;
    }

    // Status filter
    if (filters.statusFilter !== 'ALL' && scan.overallStatus !== filters.statusFilter) {
      return false;
    }

    // Category filter
    if (filters.categoryFilter !== 'all' && scan.category !== filters.categoryFilter) {
      return false;
    }

    // Clause filter
    if (filters.clauseFilter !== 'all') {
      const hasClause = scan.violations.some(v => 
        v.clauseId.toLowerCase().includes(filters.clauseFilter.toLowerCase())
      ) || scan.checkedFields.some(f => 
        f.ruleReference.toLowerCase().includes(filters.clauseFilter.toLowerCase()) && (!f.isPresent || f.isMalformed)
      );
      if (!hasClause) return false;
    }

    return true;
  });

  return (
    <div className="bg-white rounded-xl border border-[#D6DEEA] p-5 shadow-xs flex flex-col space-y-4">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#E3E9F2]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#B42318]" />
            <h3 className="font-heading font-bold text-base text-[#14224A]">
              Recent Non-Compliant Audits & Seizure Log
            </h3>
          </div>
          <p className="text-xs text-[#5B6B84]">
            Live statutory inspection repository with optical evidence, clause citations, and penal notice drafting
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#5B6B84]">Records:</span>
          <span className="font-bold text-[#14224A] bg-[#E3E9F2] px-2 py-0.5 rounded">
            {filteredScans.length} of {scans.length}
          </span>
        </div>
      </div>

      {/* Filter Bar Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#EEF2F8] p-3 rounded-lg border border-[#D6DEEA] text-xs">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#5B6B84] absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search brand, product, memo ID..."
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            className="w-full pl-8 pr-3 py-2 bg-white border border-[#D6DEEA] rounded text-xs focus:outline-none focus:border-[#14224A] font-sans"
          />
        </div>

        {/* Date Range Selector */}
        <div>
          <select
            value={filters.dateRange}
            onChange={(e) => onFilterChange({ dateRange: e.target.value as any })}
            className="w-full px-3 py-2 bg-white border border-[#D6DEEA] rounded text-xs focus:outline-none focus:border-[#14224A] font-mono"
          >
            <option value="all">Date Range: All Historic Records</option>
            <option value="7d">Past 7 Days</option>
            <option value="30d">Past 30 Days (Current Month)</option>
            <option value="90d">Past Quarter (90 Days)</option>
            <option value="ytd">Year to Date (2026)</option>
          </select>
        </div>

        {/* Category Selector */}
        <div>
          <select
            value={filters.categoryFilter}
            onChange={(e) => onFilterChange({ categoryFilter: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-[#D6DEEA] rounded text-xs focus:outline-none focus:border-[#14224A] font-sans"
          >
            <option value="all">Category: All Commodities</option>
            <option value="Food & FMCG">Food & FMCG</option>
            <option value="Cosmetics & Personal Care">Cosmetics & Personal Care</option>
            <option value="Electronics">Electronics & Gadgets</option>
            <option value="Pharmaceuticals & OTC">Pharmaceuticals & OTC</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={filters.statusFilter}
            onChange={(e) => onFilterChange({ statusFilter: e.target.value as any })}
            className="w-full px-3 py-2 bg-white border border-[#D6DEEA] rounded text-xs focus:outline-none focus:border-[#14224A] font-mono"
          >
            <option value="ALL">Status: All Scans</option>
            <option value="NON_COMPLIANT">Violations (Non-Compliant)</option>
            <option value="COMPLIANT">Verified Compliant</option>
          </select>
        </div>
      </div>

      {/* Active Clause Filter Indicator if set */}
      {filters.clauseFilter !== 'all' && (
        <div className="flex items-center justify-between bg-[#FDF3D8] border border-[#B45309]/40 px-3 py-2 rounded text-xs font-mono text-[#B45309]">
          <span>Filtered by Clause: <strong>{filters.clauseFilter}</strong></span>
          <button
            onClick={() => onFilterChange({ clauseFilter: 'all' })}
            className="text-xs text-[#14224A] underline hover:text-[#B42318]"
          >
            Reset Clause Filter
          </button>
        </div>
      )}

      {/* Scans Ledger List */}
      <div className="space-y-3">
        {filteredScans.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-[#D6DEEA] rounded-lg bg-[#EEF2F8] text-xs font-mono text-[#5B6B84]">
            No scanned packages match the specified filters. Try broadening your search or resetting clause filters.
          </div>
        ) : (
          filteredScans.map((scan) => {
            const isNonCompliant = scan.overallStatus === 'NON_COMPLIANT';

            return (
              <div
                key={scan.id}
                onClick={() => onSelectScan(scan)}
                className={`p-4 rounded-lg border transition-all cursor-pointer bg-white hover:shadow-md ${
                  isNonCompliant
                    ? 'border-[#D6DEEA] hover:border-[#B42318]'
                    : 'border-[#D6DEEA] hover:border-[#1B7A43]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Thumbnail & Main Info */}
                  <div className="flex items-start sm:items-center gap-3.5">
                    <img
                      src={scan.imageUrl}
                      alt={scan.productTitle}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md border border-[#D6DEEA] shrink-0 bg-[#E3E9F2]"
                    />

                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] font-bold bg-[#E3E9F2] text-[#14224A] px-2 py-0.5 rounded">
                          {scan.id}
                        </span>
                        <span className="text-[11px] font-medium text-[#5B6B84]">
                          {scan.category}
                        </span>
                        <span className="text-xs text-[#8B99B0]">•</span>
                        <span className="text-[11px] font-mono text-[#5B6B84]">
                          {new Date(scan.timestamp).toLocaleDateString('en-IN')}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-[#14224A] font-sans">
                        {scan.productTitle}
                      </h4>
                      <p className="text-xs text-[#5B6B84] font-mono">
                        Brand: <strong>{scan.brand}</strong> | Pack: {scan.packType}
                      </p>

                      {/* Violated Clauses Tags */}
                      {scan.violations.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[10px] font-mono font-semibold text-[#B42318]">
                            Violated Clauses:
                          </span>
                          {scan.violations.map((v, i) => (
                            <span
                              key={i}
                              className="text-[10px] font-mono font-bold bg-[#FCEAE8] text-[#B42318] px-1.5 py-0.5 rounded border border-[#B42318]/20"
                            >
                              {v.clauseId}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-[#1B7A43]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>All 6 Mandatory Declarations Compliant (PCR 2011)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Score, Stamp & Actions */}
                  <div className="flex items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 pt-2 lg:pt-0 border-[#E3E9F2]">
                    <div className="text-right font-mono">
                      <div className="text-[10px] text-[#5B6B84] uppercase">COMPLIANCE SCORE</div>
                      <div className={`text-base font-extrabold ${
                        scan.complianceScore >= 80 ? 'text-[#1B7A43]' : 'text-[#B42318]'
                      }`}>
                        {scan.complianceScore} / 100
                      </div>
                      <div className="text-[10px] text-[#B42318] font-medium max-w-[140px] truncate">
                        {scan.estimatedStatutoryFine}
                      </div>
                    </div>

                    <div className="hidden sm:block">
                      <StampBadge
                        status={scan.overallStatus}
                        size="sm"
                        rotation={-6}
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectScan(scan)}
                        className="px-3 py-1.5 bg-[#14224A] text-[#F3F6FB] text-xs font-mono rounded hover:bg-[#14224A]/90 transition-colors flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>

                      {isNonCompliant && (
                        <button
                          onClick={() => onGenerateNotice(scan)}
                          title="Generate Form-A Inspection Memo"
                          className="p-1.5 bg-[#FCEAE8] hover:bg-[#B42318] text-[#B42318] hover:text-white rounded border border-[#B42318]/30 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
