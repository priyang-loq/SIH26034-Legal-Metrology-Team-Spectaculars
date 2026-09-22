import logging
import cv2
import numpy as np
from paddleocr import PaddleOCR
from typing import List, Optional
from src.ocr.normalization import BoundingBox, OCRText, NormalizedOCRResult
from src.config import Config

logger = logging.getLogger(__name__)

class OCREngine:
    def __init__(self, use_gpu: bool = Config.USE_GPU):
        self.use_gpu = use_gpu
        self._initialize_engine()

    def _initialize_engine(self):
        try:
            device_str = "gpu:0" if self.use_gpu else "cpu"
            # Initialize PaddleOCR (PaddleOCR 3.7.0+)
            self.ocr = PaddleOCR(use_textline_orientation=True, lang=Config.OCR_LANG, device=device_str)
            
            # Verify GPU usage if requested
            if self.use_gpu:
                try:
                    import paddle
                    if paddle.device.is_compiled_with_cuda():
                        device = paddle.device.get_device()
                        logger.info(f"PaddleOCR initialized successfully using GPU. Device: {device}")
                    else:
                        logger.warning("PaddlePaddle is not compiled with CUDA! Falling back to CPU.")
                        self.use_gpu = False
                except ImportError:
                    logger.warning("Could not verify paddle GPU status. Assuming CPU fallback.")
            else:
                logger.info("PaddleOCR initialized using CPU.")
                
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {str(e)}")
            raise

    def extract_text(self, image: np.ndarray) -> NormalizedOCRResult:
        """
        Runs PaddleOCR on the image and normalizes the output.
        """
        # Run OCR using predict() instead of ocr() for PaddleOCR 3.7.0+
        results = self.ocr.predict(image)
        result_list = list(results)
        
        normalized_results = []
        if result_list and len(result_list) > 0 and result_list[0] is not None:
            res = result_list[0]
            if 'dt_polys' in res and 'rec_texts' in res and 'rec_scores' in res:
                polys = res['dt_polys']
                texts = res['rec_texts']
                scores = res['rec_scores']
                
                # Check if they have the same length
                if len(polys) == len(texts) == len(scores):
                    for i in range(len(polys)):
                        bbox = BoundingBox(points=polys[i])
                        ocr_text = OCRText(text=texts[i], confidence=scores[i], bbox=bbox)
                        normalized_results.append(ocr_text)
                else:
                    logger.warning("OCRResult lists (dt_polys, rec_texts, rec_scores) have mismatched lengths.")
                    
        device_str = "GPU" if self.use_gpu else "CPU"
        return NormalizedOCRResult(
            engine="PaddleOCR",
            device=device_str,
            results=normalized_results
        )
