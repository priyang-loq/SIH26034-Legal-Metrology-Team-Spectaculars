import cv2


def scan_qr(image):
    """
    Detect and decode a QR code from an OpenCV image.

    Parameters:
        image: OpenCV image (numpy array)

    Returns:
        dict containing detection status and decoded data
    """

    detector = cv2.QRCodeDetector()

    data, bbox, _ = detector.detectAndDecode(image)

    if data:
        return {
            "detected": True,
            "data": data,
            "bbox": bbox.tolist() if bbox is not None else None
        }

    return {
        "detected": False,
        "data": None,
        "bbox": None
    }


def scan_qr_from_file(image_path):
    """
    Scan a QR code from an image file path.
    """

    image = cv2.imread(image_path)

    if image is None:
        return {
            "detected": False,
            "data": None,
            "bbox": None,
            "error": f"Could not open image: {image_path}"
        }

    return scan_qr(image)