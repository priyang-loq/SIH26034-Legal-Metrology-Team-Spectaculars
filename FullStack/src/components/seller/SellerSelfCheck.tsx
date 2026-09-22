import React, { useState, useRef } from 'react';
import { Upload, FileImage, ShieldCheck, ShieldAlert, Sparkles, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, ArrowRight, BookOpen, FileText, Check, ScanBarcode, Loader2 } from 'lucide-react';
import { ScanResult, SellerHistoryItem } from '../../types';
import { analyzeProductLabel } from '../../services/complianceApi';
import { lookupBarcode } from '../../services/barcodeApi';
import { BarcodeScanner } from '../common/BarcodeScanner';
import { DEMO_PRESET_PRODUCTS, MOCK_SELLER_HISTORY } from '../../data/mockComplianceData';
import { StampBadge } from '../common/StampBadge';
import { SellerHistoryTable } from './SellerHistoryTable';
import confetti from 'canvas-confetti';

interface SellerSelfCheckProps {
  onOpenRulebookWithClause: (clauseId: string) => void;
  onOpenDocument?: (scanId: string) => void;
}

export const SellerSelfCheck: React.FC<SellerSelfCheckProps> = ({ onOpenRulebookWithClause, onOpenDocument }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState('');
  const [category, setCategory] = useState('Food & FMCG');
  const [packType, setPackType] = useState('Pouch');
  const [barcode, setBarcode] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeLookupStatus, setBarcodeLookupStatus] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle');

  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<SellerHistoryItem[]>(MOCK_SELLER_HISTORY);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const scanSteps = [
    'Scanning Principal Display Panel (PDP) OCR tokens...',
    'Rule 6(1)(e): Verifying MRP & Unit Sale Price declaration...',
    'Rule 6(1)(b) & Rule 12: Checking Metric Net Quantity standards...',
    'Rule 6(1)(c): Validating Month & Year of packaging/import...',
    'Rule 6(1)(f): Auditing Consumer Care telephone & grievance email...',
    'Rule 6(1)(g): Verifying Manufacturer address & Country of Origin...'
  ];

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setProductTitle(file.name.replace(/\.[^/.]+$/, ""));
    setScanResult(null);
  };

  const handlePresetSelect = (preset: typeof DEMO_PRESET_PRODUCTS[0]) => {
    setSelectedFile(null);
    setPreviewUrl(preset.imageUrl);
    setProductTitle(preset.title);
    setCategory(preset.category);
    setPackType(preset.packType);
    setScanResult(null);
  };

  const handleBarcodeDetected = async (code: string) => {
    setBarcode(code);
    setShowBarcodeScanner(false);
    setBarcodeLookupStatus('loading');
    try {
      const result = await lookupBarcode(code);
      if (result.found) {
        setBarcodeLookupStatus('found');
        if (result.productTitle) setProductTitle(result.productTitle);
        if (result.category) setCategory(result.category);
      } else {
        setBarcodeLookupStatus('not_found');
      }
    } catch {
      setBarcodeLookupStatus('not_found');
    }
  };

  const handleStartScan = async () => {
    if (!previewUrl && !selectedFile) return;

    setIsScanning(true);
    setScanStep(0);

    // Simulate step progress
    const stepInterval = setInterval(() => {
      setScanStep((prev) => {
        if (prev < scanSteps.length - 1) return prev + 1;
        return prev;
      });
    }, 280);

    try {
      // Find if preset matches or use dynamic analyzer
      const matchedPreset = DEMO_PRESET_PRODUCTS.find(p => p.imageUrl === previewUrl);
      const result = await analyzeProductLabel(selectedFile || previewUrl!, {
        productTitle: productTitle || 'Self-Check Scanned Commodity',
        category,
        packType,
        barcode: barcode || undefined,
        submittedBy: 'seller',
        simulatedPresetId: matchedPreset?.targetScanId
      });

      clearInterval(stepInterval);
      setScanResult(result);

      if (result.overallStatus === 'COMPLIANT') {
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 }
          });
        } catch (e) {
          // ignore if canvas-confetti fails
        }
      }

      // Add to seller history
      const newHistoryItem: SellerHistoryItem = {
        id: `SH-${Math.floor(1000 + Math.random() * 9000)}`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        productName: result.productTitle,
        brand: result.brand,
        sku: `SKU-${Math.floor(100 + Math.random() * 900)}`,
        category: result.category,
        status: result.overallStatus,
        score: result.complianceScore,
        missingFieldsCount: result.checkedFields.filter(f => !f.isPresent || f.isMalformed).length,
        imageUrl: result.imageUrl,
        memoId: result.inspectionMemoNumber || 'N/A'
      };

      setHistory(prev => [newHistoryItem, ...prev]);
    } catch (err) {
      clearInterval(stepInterval);
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setProductTitle('');
    setScanResult(null);
    setIsScanning(false);
  };

  return (
    <div className="space-y-6">
      {/* Seller Portal Header Banner */}
      <div className="bg-[#EEF2F8] p-5 rounded-xl border border-[#D6DEEA] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#D6DEEA] pb-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#14224A] text-[#F3F6FB] font-mono font-bold text-xs rounded">
                SELLER SELF-CHECK & PRE-LISTING AUDITOR
              </span>
              <span className="text-xs font-mono text-[#5B6B84]">E-COMMERCE & RETAIL READINESS</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#14224A] mt-1">
              Verify Product Packaging Before Listing
            </h2>
          </div>
          <div className="text-xs font-mono text-[#5B6B84] bg-[#E3E9F2] px-3 py-1.5 rounded border border-[#D6DEEA]">
            Statutory Reference: Legal Metrology (Packaged Commodities) Rules, 2011 (Rule 6)
          </div>
        </div>
        <p className="text-xs text-[#5B6B84] leading-relaxed">
          Upload your product label or box packaging artwork to verify that all 6 mandatory statutory declarations are present, correctly formatted, and compliant with Legal Metrology font standards to prevent product delisting, legal notices, and penalties under Section 36(1).
        </p>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & Label Configurator */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-[#D6DEEA] p-5 shadow-xs">
            <h3 className="font-heading font-bold text-sm text-[#14224A] mb-3 flex items-center justify-between">
              <span>1. Upload Product Label Photo</span>
              <span className="text-[11px] font-mono font-normal text-[#5B6B84]">JPG, PNG, WebP</span>
            </h3>

            {/* Dashed Ruler-Tick Border Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
              }}
              className="relative ruler-border-dashed p-6 text-center rounded-xl bg-[#EEF2F8] hover:bg-[#E3E9F2] cursor-pointer transition-all min-h-[220px] flex flex-col items-center justify-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                }}
              />

              {previewUrl ? (
                <div className="relative w-full">
                  <div className="relative rounded-lg overflow-hidden border border-[#D6DEEA] bg-black/90 max-h-[200px] flex items-center justify-center">
                    <img
                      src={previewUrl}
                      alt="Uploaded preview"
                      className="max-h-[190px] w-auto object-contain"
                    />

                    {/* Animated Scan Line Sweep */}
                    {isScanning && (
                      <div className="absolute inset-x-0 h-1 bg-[#B45309] shadow-[0_0_12px_#B45309] animate-scan-sweep z-20" />
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-[#5B6B84] mt-2 group-hover:text-[#14224A]">
                    Click or drop another image to replace
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#E3E9F2] text-[#14224A] flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-[#14224A]">
                    Drop product packaging image here
                  </div>
                  <p className="text-[11px] text-[#5B6B84]">
                    or click to browse from device / camera
                  </p>
                </div>
              )}
            </div>

            {/* Quick Demo Presets */}
            <div className="mt-4 pt-3 border-t border-[#E3E9F2]">
              <span className="text-[11px] font-mono font-bold text-[#5B6B84] uppercase block mb-2">
                Or Test with Demo Sample Labels:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_PRESET_PRODUCTS.slice(0, 4).map((preset) => {
                  const isPass = preset.subtitle.includes('PASS');
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className={`p-2 rounded-lg border text-left text-xs transition-all ${
                        previewUrl === preset.imageUrl
                          ? 'border-[#14224A] bg-[#E3E9F2] ring-1 ring-[#14224A]'
                          : 'border-[#D6DEEA] hover:bg-[#EEF2F8]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <strong className="text-[11px] text-[#14224A] truncate font-sans">{preset.title}</strong>
                        <span className={`text-[9px] font-mono font-bold px-1 rounded ${
                          isPass ? 'bg-[#E7F5EC] text-[#1B7A43]' : 'bg-[#FCEAE8] text-[#B42318]'
                        }`}>
                          {isPass ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      <p className="text-[9.5px] text-[#5B6B84] truncate mt-0.5">{preset.category}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Metadata Inputs */}
            <div className="mt-4 pt-3 border-t border-[#E3E9F2] space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#14224A] mb-1 font-mono text-[11px]">
                  PRODUCT LISTING TITLE / BRAND:
                </label>
                <input
                  type="text"
                  placeholder="e.g. NutriHarvest Roasted Almonds 200g"
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#EEF2F8] border border-[#D6DEEA] rounded text-xs focus:outline-none focus:border-[#14224A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#14224A] mb-1 font-mono text-[11px]">
                  BARCODE:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 8901234567890"
                    value={barcode}
                    onChange={(e) => { setBarcode(e.target.value); setBarcodeLookupStatus('idle'); }}
                    className="flex-1 px-3 py-2 bg-[#EEF2F8] border border-[#D6DEEA] rounded text-xs focus:outline-none focus:border-[#14224A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBarcodeScanner(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded bg-[#14224A] text-white hover:bg-[#14224A]/90 whitespace-nowrap"
                  >
                    <ScanBarcode className="w-3.5 h-3.5" />
                    Scan
                  </button>
                </div>
                {barcodeLookupStatus === 'loading' && (
                  <p className="flex items-center gap-1 text-[10px] text-[#5B6B84] mt-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Looking up product...
                  </p>
                )}
                {barcodeLookupStatus === 'found' && (
                  <p className="text-[10px] text-[#1B7A43] mt-1">Product found - title and category auto-filled.</p>
                )}
                {barcodeLookupStatus === 'not_found' && (
                  <p className="text-[10px] text-[#B45309] mt-1">No product database match - enter details manually.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-[#14224A] mb-1 font-mono text-[11px]">
                    COMMODITY SECTOR:
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2 py-2 bg-[#EEF2F8] border border-[#D6DEEA] rounded text-xs focus:outline-none focus:border-[#14224A]"
                  >
                    <option value="Food & FMCG">Food & FMCG</option>
                    <option value="Cosmetics & Personal Care">Cosmetics & Personal Care</option>
                    <option value="Electronics">Electronics & Hardware</option>
                    <option value="Pharmaceuticals & OTC">Pharmaceuticals & OTC</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#14224A] mb-1 font-mono text-[11px]">
                    PACKAGING TYPE:
                  </label>
                  <select
                    value={packType}
                    onChange={(e) => setPackType(e.target.value)}
                    className="w-full px-2 py-2 bg-[#EEF2F8] border border-[#D6DEEA] rounded text-xs focus:outline-none focus:border-[#14224A]"
                  >
                    <option value="Pouch">Pouch / Flexible Bag</option>
                    <option value="Bottle/Jar">Bottle / Rigid Jar</option>
                    <option value="Carton Box">Carton Box</option>
                    <option value="Tin/Can">Tin / Metal Can</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                <button
                  id="btn-run-seller-scan"
                  disabled={!previewUrl || isScanning}
                  onClick={handleStartScan}
                  className="w-full py-3 bg-[#14224A] text-[#F3F6FB] font-bold text-xs font-mono rounded-lg hover:bg-[#14224A]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#B45309]" />
                      <span>Auditing Statutory Rules...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#B45309]" />
                      <span>Run Legal Metrology Self-Check</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Scan Progress or Detailed Verification Result */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Scanning State Animation */}
          {isScanning && (
            <div className="bg-white rounded-xl border border-[#B45309] p-8 text-center shadow-md space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-[#B45309]/20 animate-ping" />
                <div className="w-16 h-16 rounded-full bg-[#FDF3D8] border-2 border-[#B45309] flex items-center justify-center text-[#B45309]">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              </div>

              <div>
                <h3 className="font-heading font-bold text-base text-[#14224A]">
                  Analyzing Packaging Against PCR 2011 Rules
                </h3>
                <p className="text-xs font-mono text-[#B45309] font-semibold mt-1">
                  {scanSteps[scanStep]}
                </p>
              </div>

              <div className="max-w-md mx-auto bg-[#E3E9F2] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#B45309] h-full transition-all duration-300"
                  style={{ width: `${((scanStep + 1) / scanSteps.length) * 100}%` }}
                />
              </div>

              <div className="text-[11px] font-mono text-[#5B6B84]">
                Scanning Step {scanStep + 1} of {scanSteps.length}
              </div>
            </div>
          )}

          {/* Verification Result Card */}
          {scanResult && !isScanning && (
            <div className="bg-white rounded-xl border border-[#D6DEEA] p-6 shadow-xs space-y-5">
              {/* Verdict Header Banner with Stamp Badge */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-[#EEF2F8] border border-[#D6DEEA]">
                <div className="flex items-center gap-4">
                  <StampBadge
                    status={scanResult.overallStatus}
                    size="lg"
                    rotation={-6}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono uppercase text-[#5B6B84]">VERDICT:</span>
                      <span className={`text-sm font-mono font-extrabold px-2 py-0.5 rounded ${
                        scanResult.overallStatus === 'COMPLIANT'
                          ? 'bg-[#E7F5EC] text-[#1B7A43]'
                          : scanResult.overallStatus === 'NEEDS_REVIEW' || scanResult.overallStatus === 'FLAGGED_REVIEW'
                          ? 'bg-[#FDF3D8] text-[#B45309]'
                          : 'bg-[#FCEAE8] text-[#B42318]'
                      }`}>
                        {scanResult.overallStatus === 'COMPLIANT'
                          ? 'APPROVED FOR LISTING'
                          : scanResult.overallStatus === 'NEEDS_REVIEW' || scanResult.overallStatus === 'FLAGGED_REVIEW'
                          ? 'MANUAL REVIEW REQUIRED'
                          : 'LISTING REJECTED'}
                      </span>
                    </div>

                    <h3 className="font-heading font-bold text-base text-[#14224A] mt-1">
                      {scanResult.productTitle}
                    </h3>
                    <p className="text-xs text-[#5B6B84] font-mono">
                      Compliance Score: <strong>{scanResult.complianceScore}/100</strong> • Brand: {scanResult.brand}
                    </p>
                  </div>
                </div>

                {onOpenDocument && (
                  <button
                    onClick={() => onOpenDocument(scanResult.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#14224A] text-white hover:bg-[#14224A]/90 whitespace-nowrap"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View Full Compliance Document
                  </button>
                )}

                <div className="text-right sm:border-l sm:pl-4 border-[#D6DEEA]">
                  <div className="text-[10px] font-mono text-[#5B6B84] uppercase">LEGAL RISK EXPOSURE</div>
                  <div className={`text-xs font-mono font-bold mt-0.5 ${
                    scanResult.overallStatus === 'COMPLIANT' ? 'text-[#1B7A43]' : 'text-[#B42318]'
                  }`}>
                    {scanResult.estimatedStatutoryFine}
                  </div>
                </div>
              </div>

              {/* 6 Mandatory Declarations Checklist */}
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-[#E3E9F2] pb-2">
                  <h4 className="font-bold text-xs font-mono text-[#14224A] uppercase">
                    Mandatory Declarations Audit (6 of 6 Required)
                  </h4>
                  <span className="text-xs font-mono text-[#5B6B84]">
                    {scanResult.checkedFields.filter(f => f.isPresent && !f.isMalformed).length} Passed
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {scanResult.checkedFields.map((field) => {
                    const isPass = field.status === 'FOUND' || (field.isPresent && !field.isMalformed && field.status !== 'AI_UNAVAILABLE');
                    const isUnavailable = field.status === 'AI_UNAVAILABLE';
                    const isReview = field.status === 'LOW_CONFIDENCE' || isUnavailable;
                    return (
                      <div
                        key={field.fieldId}
                        className={`p-3 rounded-lg border text-xs transition-all ${
                          isPass
                            ? 'bg-[#E7F5EC]/40 border-[#1B7A43]/30'
                            : isReview
                            ? 'bg-[#FDF3D8]/60 border-[#B45309]/40'
                            : 'bg-[#FCEAE8]/50 border-[#B42318]/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1.5">
                            {isPass ? (
                              <CheckCircle2 className="w-4 h-4 text-[#1B7A43] shrink-0" />
                            ) : isReview ? (
                              <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-[#B42318] shrink-0" />
                            )}
                            <strong className="text-[#14224A] text-[11px] font-sans">{field.fieldName}</strong>
                          </div>
                          <span className={`text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded ${
                            isPass
                              ? 'bg-[#1B7A43] text-white'
                              : isUnavailable
                              ? 'bg-[#B45309] text-white'
                              : isReview
                              ? 'bg-[#B45309] text-white'
                              : field.isPresent
                              ? 'bg-[#B42318] text-white'
                              : 'bg-[#B42318] text-white'
                          }`}>
                            {isPass ? 'OK' : isUnavailable ? 'AI UNAVAILABLE' : field.isPresent ? 'MALFORMED' : field.status === 'LOW_CONFIDENCE' ? 'UNVERIFIED' : 'MISSING'}
                          </span>
                        </div>

                        <p className="text-[11px] text-[#5B6B84] ml-5 leading-tight">
                          {field.explanation}
                        </p>

                        {!isPass && field.expectedFormat && (
                          <div className={`mt-1.5 ml-5 text-[10px] font-mono ${isReview ? 'text-[#B45309]' : 'text-[#B42318]'}`}>
                            Standard: {field.expectedFormat}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actionable Seller Remediation Guide if non-compliant */}
              {scanResult.violations.length > 0 ? (
                <div className="p-4 bg-[#FDF3D8] rounded-xl border border-[#B45309]/40 space-y-3">
                  <div className="flex items-center gap-2 text-[#B45309]">
                    <ShieldAlert className="w-5 h-5 text-[#B42318]" />
                    <h4 className="font-heading font-bold text-sm text-[#14224A]">
                      Actionable Remediation Guide for Seller
                    </h4>
                  </div>

                  <p className="text-xs text-[#5B6B84]">
                    To list this product legally without risk of seizure or fine, update your packaging artwork with the following corrections:
                  </p>

                  <div className="space-y-2">
                    {scanResult.violations.map((v, i) => (
                      <div key={i} className="p-2.5 bg-white rounded border border-[#B45309]/30 text-xs">
                        <div className="font-bold text-[#B42318] font-mono flex items-center justify-between">
                          <span>{v.clauseId}: {v.clauseTitle}</span>
                          <button
                            onClick={() => onOpenRulebookWithClause(v.clauseId)}
                            className="text-[10px] text-[#1B7A43] hover:underline font-normal"
                          >
                            View Rule Text
                          </button>
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-[#14224A]">
                          👉 <strong>Fix: </strong>{v.remediationAdvice}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : scanResult.overallStatus === 'NEEDS_REVIEW' || scanResult.overallStatus === 'FLAGGED_REVIEW' ? (
                <div className="p-4 bg-[#FDF3D8] rounded-xl border border-[#B45309]/40 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#B45309] text-white flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-sm text-[#B45309]">
                      Manual Compliance Review Required
                    </h4>
                    <p className="text-xs text-[#14224A]">
                      Certain mandatory declarations could not be conclusively verified from this label photo (evidence was ambiguous or AI verification was unavailable). Please review the unverified declarations manually before listing.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#E7F5EC] rounded-xl border border-[#1B7A43]/40 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1B7A43] text-white flex items-center justify-center shrink-0">
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-sm text-[#1B7A43]">
                      Ready for Marketplace Listing!
                    </h4>
                    <p className="text-xs text-[#14224A]">
                      This package adheres to all mandatory declarations under India's Legal Metrology (Packaged Commodities) Rules, 2011. You can safely proceed with e-commerce listing and retail distribution.
                    </p>
                  </div>
                </div>
              )}

              {/* Reset / New Check */}
              <div className="flex justify-end pt-2 border-t border-[#E3E9F2]">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-[#E3E9F2] hover:bg-[#14224A] hover:text-white text-[#14224A] font-mono text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Scan Another Product</span>
                </button>
              </div>
            </div>
          )}

          {/* Placeholder when no scan performed yet */}
          {!scanResult && !isScanning && (
            <div className="bg-white rounded-xl border border-[#D6DEEA] p-8 text-center shadow-xs flex flex-col items-center justify-center min-h-[320px] space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#EEF2F8] border border-[#D6DEEA] flex items-center justify-center text-[#5B6B84]">
                <FileImage className="w-7 h-7" />
              </div>
              <h3 className="font-heading font-bold text-base text-[#14224A]">
                No Verification Result Yet
              </h3>
              <p className="text-xs text-[#5B6B84] max-w-sm">
                Upload a label photo or select one of the sample product presets on the left, then click <strong>"Run Legal Metrology Self-Check"</strong> to see the automated rule analysis.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Seller Scan History Table */}
      <SellerHistoryTable
        history={history}
        onRecheck={(item) => {
          setProductTitle(item.productName);
          setPreviewUrl(item.imageUrl);
          handleStartScan();
        }}
      />

      {showBarcodeScanner && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}
    </div>
  );
};
