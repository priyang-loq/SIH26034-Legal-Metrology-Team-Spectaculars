import json
from src.rules.pipeline import run_compliance_pipeline
from src.normalize.normalizer import NormalizedProductFields, NormalizedField
from src.extract.schema import ExtractedField, ExtractionStatus

target_status = ExtractionStatus.SOURCE_UNAVAILABLE
from src.normalize.normalizer import NormalizedMRP, NormalizedQuantity
mrp_norm = NormalizedField(field=ExtractedField(status=ExtractionStatus.FOUND, extracted_value='99.00'), normalized=NormalizedMRP(raw_value='99.00', numeric=99.0).model_dump(), field_kind='mrp')
qty_norm = NormalizedField(field=ExtractedField(status=ExtractionStatus.FOUND, extracted_value='500 g'), normalized=NormalizedQuantity(raw_value='500 g', numeric=500.0, canonical_unit='g').model_dump(), field_kind='quantity')
dummy_date = NormalizedField(field=ExtractedField(status=ExtractionStatus.FOUND), normalized={'validation': 'VALID', 'month': 1, 'year': 2024}, field_kind='date')
dummy_phone = NormalizedField(field=ExtractedField(status=target_status), normalized=None, field_kind='phone')
dummy_email = NormalizedField(field=ExtractedField(status=target_status), normalized=None, field_kind='email')
fields = NormalizedProductFields(mrp=mrp_norm, net_quantity=qty_norm, manufacturing_date=dummy_date, expiry_date=dummy_date, consumer_care_phone=dummy_phone, consumer_care_email=dummy_email, product_name=ExtractedField(status=target_status), category=ExtractedField(status=target_status), canonical_category=ExtractedField(status=target_status), manufacturer_name=ExtractedField(status=target_status), manufacturer_address=ExtractedField(status=target_status), batch_number=ExtractedField(status=target_status), fssai=ExtractedField(status=target_status), country_of_origin=ExtractedField(status=target_status))
report = run_compliance_pipeline('H3_sim.jpg', fields, 'general', warnings=['AI_UNAVAILABLE'])
print(json.dumps(report["violations"], indent=2))
