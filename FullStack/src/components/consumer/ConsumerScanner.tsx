import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert, Sparkles, Send, Copy, Check, Info, ArrowRight, Eye, PhoneCall, ScanBarcode, Loader2, FileText } from 'lucide-react';
import { ScanResult } from '../../types';
import { analyzeProductLabel } from '../../services/complianceApi';
import { lookupBarcode } from '../../services/barcodeApi';
import { BarcodeScanner } from '../common/BarcodeScanner';
import { DEMO_PRESET_PRODUCTS } from '../../data/mockComplianceData';
import { StampBadge } from '../common/StampBadge';
import confetti from 'canvas-confetti';

interface ConsumerScannerProps {
  onOpenRulebookWithClause: (clauseId: string) => void;
  onOpenDocument?: (scanId: string) => void;
}

export const ConsumerScanner: React.FC<ConsumerScannerProps> = ({ onOpenRulebookWithClause, onOpenDocument }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [userPaidPrice, setUserPaidPrice] = useState<string>('');
  const [complaintCopied, setComplaintCopied] = useState(false);
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [barcodeLookupStatus, setBarcodeLookupStatus] = useState<'idle' | 'loading' | 'found' | 'not_found'>('idle');
  const [barcodeProductName, setBarcodeProductName] = useState<string | null>(null);

  // Camera state
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera when unmounting or switching tabs
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async () => {
    setActiveTab('camera');
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        setCameraError('Camera API not available in current environment. Please use upload mode.');
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable', err);
      setCameraError('Could not access camera device. Please allow camera permissions or upload an image.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setSelectedImage(dataUrl);
        // Stop stream
        if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
        }
        triggerScan(dataUrl);
      }
    }
  };

  const handleFileSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    setSelectedImage(url);
    triggerScan(file);
  };

  const handlePresetSelect = (preset: typeof DEMO_PRESET_PRODUCTS[0]) => {
    setSelectedImage(preset.imageUrl);
    triggerScan(preset.imageUrl, preset.targetScanId, preset.title);
  };

  const triggerScan = async (fileOrUrl: File | string, presetId?: string, title?: string) => {
    setIsScanning(true);
    setScanResult(null);
    setShowComplaintForm(false);

    try {
      const result = await analyzeProductLabel(fileOrUrl, {
        simulatedPresetId: presetId,
        productTitle: title || barcodeProductName || undefined,
        barcode: scannedBarcode || undefined,
        submittedBy: 'consumer'
      });
      setScanResult(result);

      if (result.overallStatus === 'COMPLIANT') {
        try {
          confetti({
            particleCount: 40,
            spread: 50,
            origin: { y: 0.6 }
          });
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleBarcodeDetected = async (code: string) => {
    setScannedBarcode(code);
    setShowBarcodeScanner(false);
    setBarcodeLookupStatus('loading');
    try {
      const result = await lookupBarcode(code);
      if (result.found && result.productTitle) {
        setBarcodeLookupStatus('found');
        setBarcodeProductName(result.productTitle);
      } else {
        setBarcodeLookupStatus('not_found');
        setBarcodeProductName(null);
      }
    } catch {
      setBarcodeLookupStatus('not_found');
      setBarcodeProductName(null);
    }
  };

  const handleCopyComplaint = () => {
    if (!scanResult) return;
    const complaint = `
NATIONAL CONSUMER HELPLINE GRIEVANCE
======================================
Product: ${scanResult.productTitle}
Brand: ${scanResult.brand}
Legal Metrology Inspection Result: ${scanResult.overallStatus}
Violated Clauses: ${scanResult.violations.map(v => `${v.clauseId} (${v.clauseTitle})`).join(', ')}

GRIEVANCE DETAILS:
The above product package violates mandatory packaging provisions under India's Legal Metrology (Packaged Commodities) Rules, 2011.
${userPaidPrice ? `Retailer charged: ₹${userPaidPrice}` : ''}
Specific defect: ${scanResult.violations.map(v => v.violationReason).join(' ')}

Requested Action: Please initiate statutory investigation under Section 36(1) of the Legal Metrology Act, 2009.
`;
    navigator.clipboard.writeText(complaint.trim());
    setComplaintCopied(true);
    setTimeout(() => setComplaintCopied(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Consumer Header Banner */}
      <div className="bg-[#EEF2F8] p-5 rounded-xl border border-[#D6DEEA] text-center shadow-xs">
        <div className="inline-block px-2.5 py-0.5 bg-[#1B7A43] text-[#F3F6FB] font-mono font-bold text-xs rounded mb-2">
          CITIZEN LEGAL METROLOGY CHECKER • NO LOGIN REQUIRED
        </div>
        <h2 className="text-xl sm:text-2xl font-bold font-heading text-[#14224A]">
          Check Any Packaged Commodity Instantly
        </h2>
        <p className="text-xs text-[#5B6B84] max-w-xl mx-auto mt-1">
          Take a quick photo of any package (biscuit, shampoo, electronics box, oil pack) to verify whether the seller is displaying legal MRP, true net weight, and genuine manufacturer details.
        </p>
      </div>

      {/* Main Scanner Card */}
      <div className="bg-white rounded-xl border border-[#D6DEEA] p-5 shadow-xs space-y-5">
        {/* Mode Selector Tabs */}
        <div className="flex items-center justify-center gap-2 border-b border-[#E3E9F2] pb-4">
          <button
            onClick={() => {
              setActiveTab('upload');
              if (cameraStream) {
                cameraStream.getTracks().forEach(t => t.stop());
                setCameraStream(null);
              }
            }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold rounded-lg transition-all ${
              activeTab === 'upload'
                ? 'bg-[#14224A] text-[#F3F6FB] shadow-xs'
                : 'bg-[#EEF2F8] text-[#5B6B84] hover:bg-[#E3E9F2]'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Photo</span>
          </button>

          <button
            onClick={startCamera}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold rounded-lg transition-all ${
              activeTab === 'camera'
                ? 'bg-[#14224A] text-[#F3F6FB] shadow-xs'
                : 'bg-[#EEF2F8] text-[#5B6B84] hover:bg-[#E3E9F2]'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Live Camera</span>
          </button>

          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold rounded-lg bg-[#EEF2F8] text-[#5B6B84] hover:bg-[#E3E9F2] transition-all"
          >
            <ScanBarcode className="w-4 h-4" />
            <span>Scan Barcode</span>
          </button>
        </div>

        {scannedBarcode && (
          <div className="flex items-center justify-center gap-2 text-xs font-mono -mt-2">
            <span className="text-[#5B6B84]">Barcode: {scannedBarcode}</span>
            {barcodeLookupStatus === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5B6B84]" />}
            {barcodeLookupStatus === 'found' && (
              <span className="text-[#1B7A43] font-semibold">Matched: {barcodeProductName}</span>
            )}
            {barcodeLookupStatus === 'not_found' && (
              <span className="text-[#B45309]">No database match - will still be attached to this scan.</span>
            )}
          </div>
        )}

        {/* Live Camera Feed Mode */}
        {activeTab === 'camera' && (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-4/3 max-h-[360px] mx-auto flex flex-col items-center justify-center border-2 border-[#14224A]">
            {cameraError ? (
              <div className="p-6 text-center text-white text-xs space-y-2">
                <AlertTriangle className="w-8 h-8 text-[#B45309] mx-auto" />
                <p className="font-mono text-[#B45309]">{cameraError}</p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-3 py-1.5 bg-[#E3E9F2] text-[#14224A] rounded text-xs font-bold font-mono"
                >
                  Switch to Upload Mode
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Calibrated Target Measurement Reticle */}
                <div className="absolute inset-8 border-2 border-dashed border-white/60 pointer-events-none rounded-lg flex items-center justify-center">
                  <div className="text-[10px] font-mono text-white/80 bg-black/60 px-2 py-0.5 rounded">
                    ALIGN PRODUCT LABEL HERE
                  </div>
                </div>

                {/* Capture Shutter Button */}
                <div className="absolute bottom-4 inset-x-0 flex justify-center">
                  <button
                    id="btn-camera-capture"
                    onClick={capturePhoto}
                    className="w-14 h-14 rounded-full bg-white border-4 border-[#1B7A43] shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#1B7A43]" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Upload Mode Box */}
        {activeTab === 'upload' && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
            }}
            className="relative ruler-border-dashed p-8 text-center rounded-xl bg-[#EEF2F8] hover:bg-[#E3E9F2] cursor-pointer transition-all min-h-[200px] flex flex-col items-center justify-center group"
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

            {selectedImage ? (
              <div className="relative max-h-[220px] rounded-lg overflow-hidden border border-[#D6DEEA] bg-black">
                <img
                  src={selectedImage}
                  alt="Scanned product"
                  className="max-h-[200px] w-auto object-contain mx-auto"
                />
                {isScanning && (
                  <div className="absolute inset-x-0 h-1 bg-[#B45309] shadow-[0_0_12px_#B45309] animate-scan-sweep z-20" />
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#E3E9F2] text-[#14224A] flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-[#14224A]">
                  Tap to Take Photo or Browse Label
                </div>
                <p className="text-[11px] text-[#5B6B84]">
                  Capture MRP, net weight, and back label declarations
                </p>
              </div>
            )}
          </div>
        )}

        {/* Ready-to-Click Demo Presets */}
        <div>
          <span className="text-[11px] font-mono font-bold text-[#5B6B84] uppercase block mb-2">
            Instant Test Presets (Zero-Click Demo):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DEMO_PRESET_PRODUCTS.slice(0, 4).map((preset) => {
              const isPass = preset.subtitle.includes('PASS');
              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset)}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    selectedImage === preset.imageUrl
                      ? 'border-[#14224A] bg-[#E3E9F2]'
                      : 'border-[#D6DEEA] hover:bg-[#EEF2F8]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      isPass ? 'bg-[#E7F5EC] text-[#1B7A43]' : 'bg-[#FCEAE8] text-[#B42318]'
                    }`}>
                      {isPass ? 'PASS' : 'FAIL'}
                    </span>
                    <span className="text-[10px] text-[#5B6B84]">{preset.category.split(' ')[0]}</span>
                  </div>
                  <strong className="text-xs text-[#14224A] block truncate font-sans">{preset.title}</strong>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scanning Indicator */}
        {isScanning && (
          <div className="p-4 bg-[#FDF3D8] border border-[#B45309] rounded-xl text-center font-mono text-xs text-[#B45309] flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Scanning Legal Metrology Declarations...</span>
          </div>
        )}

        {/* Consumer Result Card */}
        {scanResult && !isScanning && (
          <div className="p-5 rounded-xl border border-[#D6DEEA] bg-[#EEF2F8] space-y-4 shadow-sm">
            {/* Top Pass / Fail Verdict Banner */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-[#D6DEEA]">
              <div className="flex items-center gap-4">
                <StampBadge
                  status={scanResult.overallStatus}
                  size="md"
                  rotation={-5}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded ${
                      scanResult.overallStatus === 'COMPLIANT'
                        ? 'bg-[#E7F5EC] text-[#1B7A43]'
                        : scanResult.overallStatus === 'NEEDS_REVIEW' || scanResult.overallStatus === 'FLAGGED_REVIEW'
                        ? 'bg-[#FDF3D8] text-[#B45309]'
                        : 'bg-[#FCEAE8] text-[#B42318]'
                    }`}>
                      {scanResult.overallStatus === 'COMPLIANT'
                        ? 'GENUINE & COMPLIANT'
                        : scanResult.overallStatus === 'NEEDS_REVIEW' || scanResult.overallStatus === 'FLAGGED_REVIEW'
                        ? 'VERIFICATION INCOMPLETE — MANUAL REVIEW REQUIRED'
                        : 'DEFECTIVE / NON-COMPLIANT'}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-[#14224A] font-sans mt-1">
                    {scanResult.productTitle}
                  </h3>
                  <p className="text-xs text-[#5B6B84] font-mono">
                    Brand: <strong>{scanResult.brand}</strong> | Category: {scanResult.category}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono text-[#5B6B84] block">SAFETY SCORE</span>
                <strong className={`text-lg font-mono font-extrabold ${
                  scanResult.complianceScore >= 80 ? 'text-[#1B7A43]' : 'text-[#B42318]'
                }`}>
                  {scanResult.complianceScore}%
                </strong>
              </div>
            </div>

            {onOpenDocument && (
              <button
                onClick={() => onOpenDocument(scanResult.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#14224A] text-white hover:bg-[#14224A]/90 w-full sm:w-auto justify-center"
              >
                <FileText className="w-3.5 h-3.5" />
                View Full Compliance Document
              </button>
            )}

            {/* Quick Consumer Takeaways */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs font-mono text-[#14224A] uppercase">
                What Consumer Needs to Know:
              </h4>

              {scanResult.overallStatus === 'COMPLIANT' ? (
                <div className="p-3 bg-[#E7F5EC] rounded-lg border border-[#1B7A43]/30 text-xs text-[#1B7A43] flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>
                    ✓ This package has verified Maximum Retail Price (MRP inclusive of taxes), standard metric net weight, genuine manufacturing date, and customer care redressal details.
                  </span>
                </div>
              ) : scanResult.overallStatus === 'NEEDS_REVIEW' || scanResult.overallStatus === 'FLAGGED_REVIEW' ? (
                <div className="p-3 bg-[#FDF3D8] rounded-lg border border-[#B45309]/30 text-xs text-[#B45309] flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>
                    Certain mandatory declarations require physical verification on the packaging label (photo evidence was ambiguous or AI verification was unavailable).
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {scanResult.violations.map((v, i) => (
                    <div key={i} className="p-3 bg-[#FCEAE8] rounded-lg border border-[#B42318]/30 text-xs">
                      <div className="font-bold text-[#B42318] flex items-center justify-between font-mono">
                        <span>⚠️ Violation: {v.clauseTitle}</span>
                        <span className="text-[10px]">{v.clauseId}</span>
                      </div>
                      <p className="text-[#14224A] mt-1 text-[11px]">
                        {v.violationReason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Overcharging Verification Widget */}
            <div className="p-3 bg-white rounded-lg border border-[#D6DEEA] text-xs">
              <span className="font-bold text-[#14224A] block mb-1 font-mono text-[11px]">
                Did the shopkeeper charge more than MRP?
              </span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  placeholder="Enter amount charged (₹)"
                  value={userPaidPrice}
                  onChange={(e) => setUserPaidPrice(e.target.value)}
                  className="px-3 py-1.5 bg-[#EEF2F8] border border-[#D6DEEA] rounded text-xs w-48 font-mono focus:outline-none focus:border-[#14224A]"
                />
                {userPaidPrice && (
                  <span className="text-xs font-mono text-[#5B6B84]">
                    Overcharging above MRP is punishable under Section 36(2) of Legal Metrology Act.
                  </span>
                )}
              </div>
            </div>

            {/* Consumer Grievance Action Button */}
            {scanResult.overallStatus === 'NON_COMPLIANT' && (
              <div className="pt-2">
                <button
                  onClick={() => setShowComplaintForm(!showComplaintForm)}
                  className="w-full py-2.5 bg-[#B42318] hover:bg-[#B42318]/90 text-white text-xs font-mono font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Report Non-Compliant Product to National Consumer Helpline (NCH)</span>
                </button>

                {showComplaintForm && (
                  <div className="mt-3 p-4 bg-white rounded-lg border border-[#B42318] space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-[#B42318] font-mono">Pre-filled Legal Metrology Grievance Draft:</strong>
                      <button
                        onClick={handleCopyComplaint}
                        className="px-3 py-1 bg-[#14224A] text-white rounded text-[11px] font-mono flex items-center gap-1 hover:bg-[#14224A]/90"
                      >
                        {complaintCopied ? <Check className="w-3 h-3 text-[#1B7A43]" /> : <Copy className="w-3 h-3" />}
                        <span>{complaintCopied ? 'Copied!' : 'Copy Grievance'}</span>
                      </button>
                    </div>

                    <div className="p-3 bg-[#EEF2F8] rounded border border-[#D6DEEA] text-[11px] font-mono text-[#5B6B84] whitespace-pre-line leading-relaxed">
                      {`Grievance to: National Consumer Helpline (1915 / consumerhelpline.gov.in)
Commodity: ${scanResult.productTitle} (${scanResult.brand})
Legal Clause Violated: ${scanResult.violations.map(v => `${v.clauseId}`).join(', ')}
Summary: Statutory mandatory declarations missing or malformed under Legal Metrology (Packaged Commodities) Rules, 2011.`}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-[#5B6B84] font-mono">
                      <span>Dial Toll-Free: <strong>1915</strong> or register on INGRAM / NCH Portal</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showBarcodeScanner && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}
    </div>
  );
};
