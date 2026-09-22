import React, { useState } from 'react';
import { ScanResult, RegulatorTrendData, ClauseStatistic, FilterState } from '../../types';
import { TrendCharts } from './TrendCharts';
import { ViolatedClausesTable } from './ViolatedClausesTable';
import { NonCompliantScansLedger } from './NonCompliantScansLedger';
import { ScanDetailDrawer } from './ScanDetailDrawer';
import { InspectionMemoModal } from '../common/InspectionMemoModal';
import { ShieldCheck, ShieldAlert, FileText, Scale, AlertOctagon, TrendingDown, Users } from 'lucide-react';

interface RegulatorDashboardProps {
  scans: ScanResult[];
  trends: RegulatorTrendData[];
  topClauses: ClauseStatistic[];
  onOpenRulebookWithClause: (clauseId: string) => void;
}

export const RegulatorDashboard: React.FC<RegulatorDashboardProps> = ({
  scans,
  trends,
  topClauses,
  onOpenRulebookWithClause
}) => {
  const [selectedScanForDrawer, setSelectedScanForDrawer] = useState<ScanResult | null>(null);
  const [selectedScanForMemo, setSelectedScanForMemo] = useState<ScanResult | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    dateRange: 'all',
    clauseFilter: 'all',
    categoryFilter: 'all',
    statusFilter: 'ALL',
    severityFilter: 'all'
  });

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleSelectClauseFilter = (clauseId: string) => {
    setFilters(prev => ({ ...prev, clauseFilter: clauseId }));
  };

  return (
    <div className="space-y-6">
      {/* Top Regulator Executive Ledger Header */}
      <div className="bg-[#EEF2F8] p-5 rounded-xl border border-[#D6DEEA] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D6DEEA] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#14224A] text-[#F3F6FB] font-mono font-bold text-xs rounded">
                NATIONAL REGULATORY ENFORCEMENT PORTAL
              </span>
              <span className="text-xs font-mono text-[#5B6B84]">PCR 2011 STATUTORY SURVEILLANCE</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#14224A] mt-1">
              Legal Metrology Compliance & Inspection Intelligence
            </h2>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E7F5EC] text-[#1B7A43] rounded border border-[#1B7A43]/30 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>AI Inspection Active</span>
            </div>
          </div>
        </div>

        {/* 4 Primary Top KPI Ledger Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Audited */}
          <div className="bg-white p-4 rounded-lg border border-[#D6DEEA] shadow-xs">
            <div className="flex items-center justify-between text-[#5B6B84] text-xs font-mono">
              <span>TOTAL AUDITED PACKAGES</span>
              <Scale className="w-4 h-4 text-[#14224A]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#14224A] mt-1.5">
              34,970
            </div>
            <div className="text-[11px] text-[#1B7A43] font-mono mt-1 flex items-center gap-1">
              <span>↑ +18.4% YoY</span>
              <span className="text-[#5B6B84]">(Across 6 Commodity Sectors)</span>
            </div>
          </div>

          {/* Card 2: Non-Compliance Rate */}
          <div className="bg-white p-4 rounded-lg border border-[#D6DEEA] shadow-xs">
            <div className="flex items-center justify-between text-[#5B6B84] text-xs font-mono">
              <span>INDUSTRY NON-COMPLIANCE</span>
              <AlertOctagon className="w-4 h-4 text-[#B42318]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#B42318] mt-1.5">
              22.4%
            </div>
            <div className="text-[11px] text-[#1B7A43] font-mono mt-1">
              ↓ Decreased from 28.2% (Enforcement Impact)
            </div>
          </div>

          {/* Card 3: Top Offending Clause */}
          <div className="bg-white p-4 rounded-lg border border-[#D6DEEA] shadow-xs">
            <div className="flex items-center justify-between text-[#5B6B84] text-xs font-mono">
              <span>TOP OFFENDING PROVISION</span>
              <ShieldAlert className="w-4 h-4 text-[#B45309]" />
            </div>
            <div className="text-lg font-bold font-mono text-[#14224A] mt-1.5 truncate">
              Rule 6(1)(e) & 6(11)
            </div>
            <div className="text-[11px] text-[#5B6B84] font-mono mt-1">
              MRP & Unit Sale Price Omissions (38.2%)
            </div>
          </div>

          {/* Card 4: Sec 36 Notices */}
          <div className="bg-white p-4 rounded-lg border border-[#D6DEEA] shadow-xs">
            <div className="flex items-center justify-between text-[#5B6B84] text-xs font-mono">
              <span>SECTION 36 PENAL NOTICES</span>
              <FileText className="w-4 h-4 text-[#B42318]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#14224A] mt-1.5">
              1,842
            </div>
            <div className="text-[11px] text-[#B42318] font-mono mt-1">
              ₹ 4.60 Cr Estimated Statutory Fine Liability
            </div>
          </div>
        </div>
      </div>

      {/* Interface Section 1: Trend Charts */}
      <TrendCharts data={trends} />

      {/* Interface Section 2: Most-Violated Clauses Table */}
      <ViolatedClausesTable
        clauses={topClauses}
        selectedClauseFilter={filters.clauseFilter}
        onSelectClause={handleSelectClauseFilter}
        onOpenRulebookWithClause={onOpenRulebookWithClause}
      />

      {/* Interface Section 3: Recent Non-Compliant Audits Ledger with Filters */}
      <NonCompliantScansLedger
        scans={scans}
        filters={filters}
        onFilterChange={handleFilterChange}
        onSelectScan={(scan) => setSelectedScanForDrawer(scan)}
        onGenerateNotice={(scan) => setSelectedScanForMemo(scan)}
      />

      {/* Modals & Inspection Drawers */}
      <ScanDetailDrawer
        scan={selectedScanForDrawer}
        isOpen={!!selectedScanForDrawer}
        onClose={() => setSelectedScanForDrawer(null)}
        onGenerateNotice={(scan) => {
          setSelectedScanForDrawer(null);
          setSelectedScanForMemo(scan);
        }}
        onOpenRulebookWithClause={onOpenRulebookWithClause}
      />

      <InspectionMemoModal
        scan={selectedScanForMemo}
        isOpen={!!selectedScanForMemo}
        onClose={() => setSelectedScanForMemo(null)}
      />
    </div>
  );
};
