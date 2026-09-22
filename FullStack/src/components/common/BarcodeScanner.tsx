import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, ScanBarcode, Loader2, AlertTriangle, Keyboard, ImageUp } from 'lucide-react';
import { decodeBarcodeImage } from '../../services/barcodeApi';

// The BarcodeDetector API isn't in every TS DOM lib yet - declare a minimal
// shape for the parts we use. Supported today in Chrome/Edge/Opera; other
// browsers fall through to the manual-entry input below.
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
    };
  }
}

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

const SUPPORTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onDetected, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isDecodingImage, setIsDecodingImage] = useState(false);
  const [imageDecodeError, setImageDecodeError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const isApiSupported = typeof window !== 'undefined' && !!window.BarcodeDetector;

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isApiSupported) return;

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new window.BarcodeDetector!({ formats: SUPPORTED_FORMATS });
        setIsDetecting(true);

        const scanFrame = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) {
              const code = results[0].rawValue;
              stopCamera();
              onDetected(code);
              return;
            }
          } catch {
            // detection glitches on a single frame are fine - just keep scanning
          }
          rafRef.current = requestAnimationFrame(scanFrame);
        };

        rafRef.current = requestAnimationFrame(scanFrame);
      } catch (err: any) {
        if (!cancelled) {
          setCameraError(
            err?.name === 'NotAllowedError'
              ? 'Camera access was denied. Enter the barcode manually below instead.'
              : 'Could not access the camera. Enter the barcode manually below instead.'
          );
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isApiSupported, onDetected, stopCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualCode.trim();
    if (trimmed) {
      stopCamera();
      onDetected(trimmed);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setIsDecodingImage(true);
    setImageDecodeError(null);
    try {
      const result = await decodeBarcodeImage(file);
      if (result.success && result.data) {
        stopCamera();
        onDetected(result.data);
      } else {
        setImageDecodeError(result.error || 'No barcode or QR code detected in that photo.');
      }
    } catch (err: any) {
      setImageDecodeError(err.message || 'Could not decode that image.');
    } finally {
      setIsDecodingImage(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D6DEEA]">
          <div className="flex items-center gap-2">
            <ScanBarcode className="w-5 h-5 text-[#14224A]" />
            <h3 className="font-bold text-[#14224A]">Scan Barcode</h3>
          </div>
          <button onClick={handleClose} className="text-[#5B6B84] hover:text-[#14224A]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isApiSupported ? (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              {isDetecting && (
                <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-[#B45309] animate-scan-sweep" />
              )}
              {cameraError && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4">
                  <p className="text-white text-xs text-center">{cameraError}</p>
                </div>
              )}
              {!cameraError && (
                <div className="absolute bottom-2 inset-x-0 flex justify-center">
                  <span className="flex items-center gap-1.5 bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Point the camera at the barcode
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2 bg-[#FDF3D8] border border-[#B45309]/30 text-[#B45309] text-xs rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Live camera scanning isn't supported in this browser (works in Chrome or Edge). Enter the barcode number manually below.</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-[#D6DEEA]" />
            <span className="text-[10px] font-mono text-[#8B99B0]">OR</span>
            <div className="h-px flex-1 bg-[#D6DEEA]" />
          </div>

          <div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]);
              }}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isDecodingImage}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-lg border border-[#D6DEEA] bg-[#EEF2F8] text-[#14224A] hover:bg-[#E3E9F2] disabled:opacity-60"
            >
              {isDecodingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageUp className="w-4 h-4" />}
              <span>{isDecodingImage ? 'Decoding photo...' : 'Upload a photo of the barcode'}</span>
            </button>
            {imageDecodeError && (
              <p className="text-[11px] text-[#B45309] mt-1.5">{imageDecodeError}</p>
            )}
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#14224A]">
              <Keyboard className="w-3.5 h-3.5" />
              Or enter the barcode number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. 8901234567890"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-[#D6DEEA] focus:outline-none focus:border-[#14224A]"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#14224A] text-white disabled:opacity-40"
              >
                Use
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
