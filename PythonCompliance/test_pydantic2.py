from typing import Optional, List, Union
from pydantic import BaseModel

class ProductFields(BaseModel):
    name: str

class StructuredExtractionResult(BaseModel):
    fields: Union['ProductFields', 'NormalizedProductFields']

class NormalizedProductFields(BaseModel):
    normalized_name: str

StructuredExtractionResult.model_rebuild()

r1 = StructuredExtractionResult(fields=ProductFields(name="test"))
r2 = StructuredExtractionResult(fields=NormalizedProductFields(normalized_name="test"))
print("Success")
