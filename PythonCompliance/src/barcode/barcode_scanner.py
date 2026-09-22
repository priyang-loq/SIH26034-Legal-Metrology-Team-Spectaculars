import cv2


def scan_barcode(image):
    """
    Detect and decode a barcode from an OpenCV image.

    Parameters:
        image: OpenCV image (numpy array)

    Returns:
        dict containing detection status and decoded data
    """

    detector = cv2.barcode.BarcodeDetector()

    data, bbox, _ = detector.detectAndDecode(image)

    if data:
        return {
            "detected": True,
            "data": data,
            "bbox": bbox.tolist() if bbox is not None else None,
            "status": "SUCCESS"
        }

    elif bbox is not None:
        return {
            "detected": True,
            "data": None,
            "bbox": bbox.tolist(),
            "status": "DETECTED_NOT_DECODED"
        }

    return {
        "detected": False,
        "data": None,
        "bbox": None,
        "status": "NOT_DETECTED"
    }


def scan_barcode_from_file(image_path):
    """
    Scan a barcode from an image file path.
    """

    image = cv2.imread(image_path)

    if image is None:
        return {
            "detected": False,
            "data": None,
            "bbox": None,
            "status": "ERROR",
            "error": f"Could not open image: {image_path}"
        }

    return scan_barcode(image)