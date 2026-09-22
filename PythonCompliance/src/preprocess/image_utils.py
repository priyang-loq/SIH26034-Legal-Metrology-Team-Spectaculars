import cv2
import numpy as np
from typing import Tuple

def resize_if_needed(image: np.ndarray, max_size: Tuple[int, int] = (1280, 1280)) -> np.ndarray:
    """Resize image to fit within max_size while maintaining aspect ratio."""
    h, w = image.shape[:2]
    max_w, max_h = max_size
    
    if w > max_w or h > max_h:
        scale = min(max_w / w, max_h / h)
        new_w, new_h = int(w * scale), int(h * scale)
        image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return image

def preprocess_for_ocr(image: np.ndarray) -> np.ndarray:
    """
    Standard preprocessing for PaddleOCR. 
    PaddleOCR handles its own RGB conversion internally, but doing basic 
    resizing and subtle sharpening can sometimes help for product images.
    """
    img = resize_if_needed(image)
    
    # Optional: Apply slight sharpening if the image is blurry
    # kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    # img = cv2.filter2D(img, -1, kernel)
    
    return img

def preprocess_grayscale_adaptive(image: np.ndarray) -> np.ndarray:
    """
    Alternative preprocessing: Grayscale + Adaptive Thresholding.
    Useful as a fallback if the original color image yields bad OCR results.
    """
    img = resize_if_needed(image)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Adaptive thresholding to handle uneven lighting on product labels
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )
    
    # Convert back to 3 channel so PaddleOCR doesn't complain about dims
    thresh_color = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
    return thresh_color
