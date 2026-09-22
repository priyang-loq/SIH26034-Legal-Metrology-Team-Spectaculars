import cv2
import numpy as np
from src.ocr.normalization import NormalizedOCRResult
from src.extract.schema import StructuredExtractionResult

def draw_ocr_results(image: np.ndarray, ocr_data: NormalizedOCRResult) -> np.ndarray:
    """Draws bounding boxes and text for all OCR results."""
    img_draw = image.copy()
    
    for item in ocr_data.results:
        # Convert bbox points to integers
        pts = np.array(item.bbox.points, np.int32)
        pts = pts.reshape((-1, 1, 2))
        
        # Draw polygon
        cv2.polylines(img_draw, [pts], True, (0, 255, 0), 2)
        
        # Put text
        x, y = pts[0][0]
        cv2.putText(img_draw, f"{item.text} ({item.confidence:.2f})", (x, y - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
                    
    return img_draw

def draw_extracted_fields(image: np.ndarray, result: StructuredExtractionResult) -> np.ndarray:
    """Draws bounding boxes specifically for successfully extracted fields."""
    img_draw = image.copy()
    
    fields = result.fields.model_dump()
    for field_name, field_data in fields.items():
        if field_data.get('extracted_value') and field_data.get('bbox'):
            bbox = field_data['bbox']['points']
            pts = np.array(bbox, np.int32).reshape((-1, 1, 2))
            cv2.polylines(img_draw, [pts], True, (255, 0, 0), 3) # Blue for fields
            
            x, y = pts[0][0]
            val = field_data['extracted_value']
            cv2.putText(img_draw, f"{field_name}: {val}", (x, y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)
                        
    return img_draw
