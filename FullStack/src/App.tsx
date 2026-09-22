import React, { useState, useEffect } from 'react';
import { Header, AppView } from './components/common/Header';
import { RulerBar } from './components/common/RulerBar';
import { RegulatorDashboard } from './components/regulator/RegulatorDashboard';
import { SellerSelfCheck } from './components/seller/SellerSelfCheck';
import { ConsumerScanner } from './components/consumer/ConsumerScanner';
import { PublicConsumerDashboard } from './components/public/PublicConsumerDashboard';
import { ClauseDetailModal } from './components/common/ClauseDetailModal';
import { fetchRegulatorAnalytics } from './services/complianceApi';
import { ScanResult, RegulatorTrendData, ClauseStatistic } from './types';
import { MOCK_SCAN_RESULTS, MOCK_REGULATOR_TRENDS, MOCK_CLAUSE_STATISTICS } from './data/mockComplianceData';
import { Scale, ShieldCheck, FileText, ExternalLink } from 'lucide-react';
import { AuthorityLogin } from './components/authority/AuthorityLogin';
import { AuthorityPortal } from './components/authority/AuthorityPortal';
import { ProductComplianceDocument } from './components/common/ProductComplianceDocument';
import { AuthorityUser, getAuthorityUser, isAuthorityLoggedIn } from './services/authApi';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(() => {
    return (typeof window !== 'undefined' ? (sessionStorage.getItem('lmpc_current_view') as AppView) : null) || 'regulator';
  });
  const [isRulebookOpen, setIsRulebookOpen] = useState(false);
  const [selectedClauseForModal, setSelectedClauseForModal] = useState<string | undefined>(undefined);
  const [authorityUser, setAuthorityUser] = useState<AuthorityUser | null>(
    isAuthorityLoggedIn() ? getAuthorityUser() : null
  );
  const [documentScanId, setDocumentScanId] = useState<string | null>(null);

  const [scans, setScans] = useState<ScanResult[]>(MOCK_SCAN_RESULTS);
  const [trends, setTrends] = useState<RegulatorTrendData[]>(MOCK_REGULATOR_TRENDS);
  const [topClauses, setTopClauses] = useState<ClauseStatistic[]>(MOCK_CLAUSE_STATISTICS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleAuthorityLogout = () => {
      setAuthorityUser(null);
    };
    window.addEventListener('authority-logout', handleAuthorityLogout);
    return () => window.removeEventListener('authority-logout', handleAuthorityLogout);
  }, []);

  const handleViewChange = (view: AppView) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lmpc_current_view', view);
    }
    setCurrentView(view);
  };

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchRegulatorAnalytics();
        setScans(data.recentScans);
        setTrends(data.trends);
        setTopClauses(data.topClauses);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleOpenRulebookWithClause = (clauseId: string) => {
    setSelectedClauseForModal(clauseId);
    setIsRulebookOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F6FB] text-[#14224A] font-sans selection:bg-[#B45309]/25">
      {/* Top Header Navigation */}
      <Header
        currentView={currentView}
        onViewChange={handleViewChange}
        onOpenRulebook={() => {
          setSelectedClauseForModal(undefined);
          setIsRulebookOpen(true);
        }}
      />

      {/* Decorative Metric Calibrated Ruler Bar */}
      <RulerBar label="LEGAL METROLOGY (PACKAGED COMMODITIES) RULES, 2011 • STATUTORY AUDIT BENCHMARK" />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 md:py-8">
        {documentScanId ? (
          <ProductComplianceDocument
            scanId={documentScanId}
            onBack={() => setDocumentScanId(null)}
          />
        ) : (
          <>
            {currentView === 'regulator' && (
              <RegulatorDashboard
                scans={scans}
                trends={trends}
                topClauses={topClauses}
                onOpenRulebookWithClause={handleOpenRulebookWithClause}
              />
            )}

            {currentView === 'seller' && (
              <SellerSelfCheck
                onOpenRulebookWithClause={handleOpenRulebookWithClause}
                onOpenDocument={setDocumentScanId}
              />
            )}

            {currentView === 'consumer' && (
              <ConsumerScanner
                onOpenRulebookWithClause={handleOpenRulebookWithClause}
                onOpenDocument={setDocumentScanId}
              />
            )}

            {currentView === 'publicDashboard' && <PublicConsumerDashboard />}

            {currentView === 'authority' && (
              authorityUser ? (
                <AuthorityPortal
                  user={authorityUser}
                  onLogout={() => {
                    setAuthorityUser(null);
                    handleViewChange('regulator');
                  }}
                  onOpenDocument={setDocumentScanId}
                />
              ) : (
                <AuthorityLogin
                  onLoginSuccess={(user) => {
                    setAuthorityUser(user);
                    handleViewChange('authority');
                  }}
                  onBack={() => handleViewChange('regulator')}
                />
              )
            )}
          </>
        )}
      </main>

      {/* Footer with Statutory Seal */}
      <footer className="border-t border-[#D6DEEA] bg-[#E3E9F2] py-6 px-4 text-xs font-mono text-[#5B6B84] mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#14224A] text-[#B45309] flex items-center justify-center font-bold">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-[#14224A] font-sans">
                Legal Metrology Packaging Compliance Inspection System
              </p>
              <p className="text-[11px]">
                Statutory reference: The Legal Metrology Act, 2009 (No. 1 of 2010) & PCR 2011 (as amended)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <button
              onClick={() => {
                setSelectedClauseForModal(undefined);
                setIsRulebookOpen(true);
              }}
              className="hover:text-[#14224A] underline flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Gazette PCR 2011 Handbook</span>
            </button>
            <span className="text-[#8B99B0]">|</span>
            <span>Smart India Hackathon Project: <strong>SIH26034</strong></span>
          </div>
        </div>
      </footer>

      {/* Global Rulebook Clause Detail Modal */}
      <ClauseDetailModal
        isOpen={isRulebookOpen}
        onClose={() => setIsRulebookOpen(false)}
        selectedClauseId={selectedClauseForModal}
      />
    </div>
  );
}
