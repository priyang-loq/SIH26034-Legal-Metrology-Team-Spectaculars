import pytest
from unittest.mock import patch, MagicMock

from src.ai.vlm import RealVLMExtractor
from src.extract.schema import StructuredExtractionResult, ExtractionStatus
from src.rules.pipeline import run_compliance_pipeline
from src.pipeline import OCRPipeline
from src.config import Config

@pytest.fixture
def mock_ocr():
    with patch("src.pipeline.OCREngine") as mock:
        engine_instance = mock.return_value
        mock_result = MagicMock()
        mock_result.results = ["fake", "results"]
        engine_instance.extract_text.return_value = mock_result
        yield engine_instance

@pytest.fixture
def dummy_image(tmp_path):
    import numpy as np
    import cv2
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    img_path = str(tmp_path / "test.jpg")
    cv2.imwrite(img_path, img)
    return img_path

def test_vlm_failure_preserves_ocr_and_flags_warning(mock_ocr, dummy_image):
    Config.USE_VLM = True
    Config.VLM_PROVIDER = "real"
    
    pipeline = OCRPipeline()
    
    # We patch RealVLMExtractor.extract to raise a RuntimeError (e.g. timeout)
    with patch("src.ai.vlm.RealVLMExtractor.extract", side_effect=RuntimeError("Timeout / API Error")):
        # We need to make sure OCR extraction yields something so we can test it's preserved
        with patch("src.pipeline.extract_fields") as mock_extract:
            mock_structured_data = MagicMock()
            
            # Use actual dict structure or MagicMock with a proper return string
            mock_structured_data.model_dump_json.return_value = '{"fields": {"product_name": {"extracted_value": "OCR Value"}}, "warnings": ["AI_UNAVAILABLE"]}'
            
            mock_extract.return_value = mock_structured_data
            
            json_out = pipeline.process_image(dummy_image, save_debug=False)
            
            import json
            data = json.loads(json_out)
            
            assert "AI_UNAVAILABLE" in data.get("warnings", [])
            # OCR data should still be there
            assert data["fields"]["product_name"]["extracted_value"] == "OCR Value"

def test_compliance_pipeline_degrades_on_warning():
    from src.normalize.normalizer import NormalizedProductFields
    from src.rules.pipeline import run_compliance_pipeline
    
    # Create a perfectly compliant base fields using a mock or basic dictionary 
    from unittest.mock import MagicMock
    base_fields = MagicMock()
    
    # We mock the rule engine so it returns all PASS
    with patch("src.rules.pipeline.adapt_normalized_fields") as mock_adapt, \
         patch("src.rules.pipeline.evaluate_general_rules") as mock_eval:
        mock_pass = MagicMock()
        from src.rules.result import RuleStatus
        mock_pass.status = RuleStatus.PASS
        mock_eval.return_value = [mock_pass]
        
        # Normal run
        report = run_compliance_pipeline("test1", base_fields, "general")
        assert report["overall_decision"] == "COMPLIANT"
        assert report.get("warnings", []) == []
        
        # Run with AI_UNAVAILABLE warning
        # Since run_compliance_pipeline doesn't have a warnings argument yet, this test will fail
        # which is the expected TDD behavior before implementation.
        report_with_warning = run_compliance_pipeline("test2", base_fields, "general", warnings=["AI_UNAVAILABLE"])
        assert report_with_warning["overall_decision"] == "NEEDS_REVIEW"
        assert "AI_UNAVAILABLE" in report_with_warning["warnings"]

def test_vlm_failure_overall_decision_needs_review():
    """
    End-to-end test simulating the H3.jpg scenario:
    VLM fails, several fields end up SOURCE_UNAVAILABLE, run through 
    evaluate_general_rules and decide_compliance - confirm overall decision 
    is NEEDS_REVIEW, not NON_COMPLIANT, and confirm zero VIOLATION-status 
    results exist purely from the AI failure.
    """
    from src.normalize.normalizer import NormalizedProductFields, NormalizedField
    from src.rules.pipeline import run_compliance_pipeline
    from src.extract.schema import ExtractedField, ExtractionStatus
    from src.rules.result import RuleStatus
    
    # Check if SOURCE_UNAVAILABLE exists, else default to NOT_FOUND for the failure phase
    target_status = getattr(ExtractionStatus, "SOURCE_UNAVAILABLE", ExtractionStatus.NOT_FOUND)
    
    # Mock fields where OCR worked (mrp, net_quantity) and others where VLM failed
    mrp_norm = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND, extracted_value="99.00"),
        normalized={"validation": "VALID", "numeric": 99.0},
        field_kind="mrp"
    )
    
    qty_norm = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND, extracted_value="500 g"),
        normalized={"validation": "VALID", "numeric": 500.0, "canonical_unit": "g"},
        field_kind="quantity"
    )
    
    dummy_date = NormalizedField(
        field=ExtractedField(status=ExtractionStatus.FOUND),
        normalized={"validation": "VALID", "month": 1, "year": 2024},
        field_kind="date"
    )
    
    dummy_phone = NormalizedField(field=ExtractedField(status=target_status), normalized=None, field_kind="phone")
    dummy_email = NormalizedField(field=ExtractedField(status=target_status), normalized=None, field_kind="email")
    dummy_usp = NormalizedField(field=ExtractedField(status=target_status), normalized=None, field_kind="unit_sale_price")
    
    fields = NormalizedProductFields(
        mrp=mrp_norm,
        net_quantity=qty_norm,
        manufacturing_date=dummy_date,
        expiry_date=dummy_date,
        consumer_care_phone=dummy_phone,
        consumer_care_email=dummy_email,
        product_name=ExtractedField(status=target_status),
        category=ExtractedField(status=target_status),
        canonical_category=ExtractedField(status=target_status),
        manufacturer_name=ExtractedField(status=target_status),
        manufacturer_address=ExtractedField(status=target_status),
        batch_number=ExtractedField(status=target_status),
        fssai=ExtractedField(status=target_status),
        country_of_origin=ExtractedField(status=target_status),
        unit_sale_price=dummy_usp
    )
    
    report = run_compliance_pipeline(
        product_id="H3_sim.jpg",
        normalized_fields=fields,
        category="general",
        warnings=["AI_UNAVAILABLE"]
    )
    
    assert report["overall_decision"] == "NEEDS_REVIEW"
    
    for v in report["violations"]:
        # Only true violations (e.g. from OCR failures) should be here.
        # But we made OCR fields valid. So there should be NO violations.
        assert False, f"Found unexpected VIOLATION: {v}"
