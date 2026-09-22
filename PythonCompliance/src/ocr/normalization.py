from pydantic import BaseModel
from typing import List, Tuple

class BoundingBox(BaseModel):
    # Represents [ [x1, y1], [x2, y2], [x3, y3], [x4, y4] ]
    points: List[List[float]]
    
    @property
    def center(self) -> Tuple[float, float]:
        xs = [p[0] for p in self.points]
        ys = [p[1] for p in self.points]
        return sum(xs) / 4.0, sum(ys) / 4.0

class OCRText(BaseModel):
    text: str
    confidence: float
    bbox: BoundingBox
    
class NormalizedOCRResult(BaseModel):
    engine: str = "PaddleOCR"
    device: str
    preprocessing_variant: str = "standard"
    results: List[OCRText]
