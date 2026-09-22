const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface BarcodeLookupResult {
  code: string;
  found: boolean;
  productTitle: string | null;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  source: string | null;
  cached: boolean;
}

export async function lookupBarcode(code: string): Promise<BarcodeLookupResult> {
  const res = await fetch(`${API_BASE}/barcode/${encodeURIComponent(code)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Barcode lookup failed.' }));
    throw new Error(err.error || 'Barcode lookup failed.');
  }
  return res.json();
}

export interface DecodeImageResult {
  success: boolean;
  type?: 'barcode' | 'qrcode';
  data?: string;
  lookup?: BarcodeLookupResult | null;
  error?: string;
}

/**
 * Decodes a barcode/QR code from an uploaded photo using the server-side
 * OpenCV detector (server/scripts/decode_barcode.py). Use this when the
 * person has a photo of a barcode rather than using the live camera scanner.
 */
export async function decodeBarcodeImage(file: File): Promise<DecodeImageResult> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${API_BASE}/barcode/decode-image`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Image decoding failed.' }));
    throw new Error(err.error || 'Image decoding failed.');
  }
  return res.json();
}
