import React from 'react';
import { Scale, ShieldAlert, Store, ScanLine, BookOpen, AlertCircle, Sparkles, Lock, LayoutDashboard } from 'lucide-react';

export type AppView = 'regulator' | 'seller' | 'consumer' | 'authority' | 'publicDashboard';

interface HeaderProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  onOpenRulebook: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  onOpenRulebook
}) => {
  return (
    <header className="border-b border-[#D6DEEA] bg-[#EEF2F8] sticky top-0 z-40">
      {/* Top Gazette Ribbon */}
      <div className="bg-[#14224A] text-[#F3F6FB] px-4 py-1.5 text-xs font-mono flex flex-wrap items-center justify-between gap-2 border-b border-[#14224A]/20">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#1B7A43] animate-pulse" />
          <span className="font-semibold tracking-wider text-[11px]">GOVERNMENT OF INDIA</span>
          <span className="text-[#8B99B0] hidden sm:inline">|</span>
          <span className="text-[#8B99B0] hidden sm:inline text-[11px]">MINISTRY OF CONSUMER AFFAIRS, FOOD & PUBLIC DISTRIBUTION</span>
          <span className="text-[#8B99B0] hidden md:inline">|</span>
          <span className="bg-[#B45309]/20 text-[#B45309] text-[10px] px-1.5 py-0.2 rounded font-mono font-bold hidden md:inline">
            SIH26034
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[#8B99B0]">
          <span className="hidden lg:inline">LEGAL METROLOGY (PACKAGED COMMODITIES) RULES, 2011</span>
          <span className="text-[#F3F6FB] font-semibold bg-[#1B7A43]/40 px-2 py-0.5 rounded text-[10px]">
            ACTIVE ENFORCEMENT
          </span>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-[#14224A] text-[#F3F6FB] flex items-center justify-center shadow-inner border border-[#14224A]">
            <Scale className="w-6 h-6 text-[#B45309]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#14224A] font-heading flex items-center gap-2">
                LMPC Compliance Inspector
              </h1>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-[#14224A]/10 text-[#14224A] rounded">
                v2.6
              </span>
            </div>
            <p className="text-xs text-[#5B6B84] font-medium">
              Automated Statutory Declaration Scanner under Legal Metrology Act, 2009
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Navigation Pill Group */}
          <nav className="inline-flex p-1 bg-[#E3E9F2] rounded-lg border border-[#D6DEEA]">
            <button
              id="tab-regulator-dashboard"
              onClick={() => onViewChange('regulator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                currentView === 'regulator'
                  ? 'bg-[#14224A] text-[#F3F6FB] shadow-sm'
                  : 'text-[#5B6B84] hover:text-[#14224A] hover:bg-[#DCE4F0]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>1. Regulator Analytics</span>
            </button>

            <button
              id="tab-seller-self-check"
              onClick={() => onViewChange('seller')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                currentView === 'seller'
                  ? 'bg-[#14224A] text-[#F3F6FB] shadow-sm'
                  : 'text-[#5B6B84] hover:text-[#14224A] hover:bg-[#DCE4F0]'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>2. Seller Self-Check</span>
            </button>

            <button
              id="tab-consumer-scanner"
              onClick={() => onViewChange('consumer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                currentView === 'consumer'
                  ? 'bg-[#14224A] text-[#F3F6FB] shadow-sm'
                  : 'text-[#5B6B84] hover:text-[#14224A] hover:bg-[#DCE4F0]'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>3. Consumer Scan</span>
            </button>

            <button
              id="tab-public-dashboard"
              onClick={() => onViewChange('publicDashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                currentView === 'publicDashboard'
                  ? 'bg-[#14224A] text-[#F3F6FB] shadow-sm'
                  : 'text-[#5B6B84] hover:text-[#14224A] hover:bg-[#DCE4F0]'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>4. Public Dashboard</span>
            </button>
          </nav>

          {/* Rulebook Modal Trigger */}
          <button
            id="btn-open-rules-handbook"
            onClick={onOpenRulebook}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-lg border border-[#D6DEEA] bg-[#EEF2F8] text-[#14224A] hover:bg-[#E3E9F2] transition-colors"
            title="View Legal Metrology Rules, 2011 Clauses"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#1B7A43]" />
            <span className="hidden sm:inline">Rules Handbook</span>
          </button>

          {/* Private Authority Portal - deliberately separated from the main nav pills */}
          <button
            id="btn-authority-portal"
            onClick={() => onViewChange('authority')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors ${
              currentView === 'authority'
                ? 'bg-[#14224A] text-[#B45309] border-[#14224A]'
                : 'border-[#D6DEEA] bg-[#EEF2F8] text-[#14224A] hover:bg-[#E3E9F2]'
            }`}
            title="Private access for Legal Metrology authority officers"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Authority Portal</span>
          </button>
        </div>
      </div>
    </header>
  );
};
