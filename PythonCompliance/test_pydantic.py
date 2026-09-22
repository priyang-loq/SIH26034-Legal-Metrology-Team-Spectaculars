from pydantic import BaseModel
from typing import Union

class StructuredExtractionResult(BaseModel):
    fields: Union['ProductFields', 'NormalizedProductFields']

print("Success")
