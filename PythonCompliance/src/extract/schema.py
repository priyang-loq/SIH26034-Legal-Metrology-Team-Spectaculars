from enum import Enum
from pydantic import BaseModel
from typing import Optional, Any, List, Union
from src.ocr.normalization import NormalizedOCRResult, BoundingBox, OCRText

class ExtractionStatus(str, Enum):
    FOUND = "FOUND"
    NOT_FOUND = "NOT_FOUND"
    AMBIGUOUS = "AMBIGUOUS"
    INVALID = "INVALID"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"
    DEFERRED_TO_OTHER_SURFACE = "DEFERRED_TO_OTHER_SURFACE"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"

class ExtractedField(BaseModel):
    status: ExtractionStatus = ExtractionStatus.NOT_FOUND
    extracted_value: Optional[str] = None
    original_value: Optional[str] = None
    officer_override: Optional[str] = None
    normalized_value: Optional[Any] = None
    unit: Optional[str] = None
    source_text: Optional[str] = None
    evidence: List[OCRText] = []
    extraction_confidence: float = 0.0
    bbox: Optional[BoundingBox] = None

class CompanyInfo(BaseModel):
    name: ExtractedField = ExtractedField()
    address: ExtractedField = ExtractedField()

class ConsumerCareInfo(BaseModel):
    name: ExtractedField = ExtractedField()
    address: ExtractedField = ExtractedField()
    phone: ExtractedField = ExtractedField()
    email: ExtractedField = ExtractedField()

class ProductFields(BaseModel):
    barcode: ExtractedField = ExtractedField()
    product_name: ExtractedField = ExtractedField()
    category: ExtractedField = ExtractedField()
    mrp: ExtractedField = ExtractedField()
    net_quantity: ExtractedField = ExtractedField()
    manufacturer: CompanyInfo = CompanyInfo()
    packer: CompanyInfo = CompanyInfo()
    importer: CompanyInfo = CompanyInfo()
    consumer_care: ConsumerCareInfo = ConsumerCareInfo()
    country_of_origin: ExtractedField = ExtractedField()
    manufacturing_date: ExtractedField = ExtractedField()
    expiry_date: ExtractedField = ExtractedField()
    batch_number: ExtractedField = ExtractedField()
    fssai: ExtractedField = ExtractedField()
    canonical_category: ExtractedField = ExtractedField()
    import_status: ExtractedField = ExtractedField()
    unit_sale_price: ExtractedField = ExtractedField()
    
class StructuredExtractionResult(BaseModel):
    image_path: str
    ocr_info: NormalizedOCRResult
    fields: Union[ProductFields, 'NormalizedProductFields']
    product_intelligence: Optional[dict] = None
    warnings: List[str] = []
    # 'NormalizedProductFields' is a forward reference resolved at runtime by
    # StructuredExtractionResult.model_rebuild() called from pipeline.py
    # AFTER both schema and normalizer modules are fully initialised.
    # Do NOT import normalizer here — that would create a circular dependency.
