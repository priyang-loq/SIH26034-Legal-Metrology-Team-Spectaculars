"""
Barcode / QR decoder - server-side image decoding.

Adapted from the team's original scanner.py (QR, cv2.QRCodeDetector) and
barcode_scanner.py (1D barcodes, cv2.barcode.BarcodeDetector), combined into
a single script the Node backend calls as a subprocess for one uploaded image.

Usage:
    python3 decode_barcode.py <path-to-image>

Outputs a single line of JSON to stdout:
    {"success": true,  "type": "barcode", "data": "8901234567890"}
    {"success": true,  "type": "qrcode",  "data": "https://example.com"}
    {"success": false, "type": null,      "data": null, "error": "..."}

Requires: opencv-python (pip install opencv-python)
"""
import sys
import json

def fail(message):
    print(json.dumps({"success": False, "type": None, "data": None, "error": message}))
    sys.exit(0)  # exit 0 - this is a normal "nothing found" outcome, not a crash

try:
    import cv2
except ImportError:
    fail("opencv-python is not installed on this server. Run: pip install opencv-python")

if len(sys.argv) < 2:
    fail("No image path provided.")

image_path = sys.argv[1]
image = cv2.imread(image_path)

if image is None:
    fail(f"Could not open image at {image_path}")

# 1. Try 1D barcodes first (EAN-13, EAN-8, UPC-A, etc.) - this is what most
#    packaged-commodity labels actually carry.
try:
    barcode_detector = cv2.barcode.BarcodeDetector()
    decoded_data, bbox, _ = barcode_detector.detectAndDecode(image)

    # decoded_data can be a tuple of strings (multiple barcodes) or a single string
    if decoded_data:
        if isinstance(decoded_data, (tuple, list)):
            first_nonempty = next((d for d in decoded_data if d), None)
        else:
            first_nonempty = decoded_data or None

        if first_nonempty:
            print(json.dumps({"success": True, "type": "barcode", "data": first_nonempty}))
            sys.exit(0)
except AttributeError:
    # Older OpenCV builds without cv2.barcode - fall through to QR-only detection
    pass

# 2. Fall back to QR code detection
qr_detector = cv2.QRCodeDetector()
data, bbox, _ = qr_detector.detectAndDecode(image)

if data:
    print(json.dumps({"success": True, "type": "qrcode", "data": data}))
    sys.exit(0)

fail("No barcode or QR code detected in this image.")
