import pytest
import cv2
import os
import json
from unittest.mock import patch, MagicMock

from src.config import Config
from src.pipeline import OCRPipeline
from src.ai.vlm import MockVLMExtractor, RealVLMExtractor

@pytest.fixture
def mock_ocr():
    with patch("src.pipeline.OCREngine") as mock:
        engine_instance = mock.return_value
        # Mock the extract_text to return an object with a 'results' list so it doesn't trigger fallback
        mock_result = MagicMock()
        mock_result.results = ["fake", "results", "here"]
        engine_instance.extract_text.return_value = mock_result
        yield engine_instance

@pytest.fixture
def dummy_image(tmp_path):
    import numpy as np
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    img_path = str(tmp_path / "test.jpg")
    cv2.imwrite(img_path, img)
    return img_path

def test_pipeline_selects_mock_vlm(mock_ocr, dummy_image):
    Config.USE_VLM = True
    Config.VLM_PROVIDER = "mock"
    
    pipeline = OCRPipeline()
    
    with patch("src.ai.vlm.MockVLMExtractor") as MockVLM, \
         patch("src.ai.vlm.RealVLMExtractor") as RealVLM, \
         patch("src.pipeline.extract_fields") as mock_extract:
         
        mock_extract.return_value.fields = MagicMock()
        mock_extract.return_value.model_dump_json.return_value = "{}"
         
        pipeline.process_image(dummy_image, save_debug=False)
        
        MockVLM.assert_called_once()
        RealVLM.assert_not_called()
        MockVLM.return_value.extract.assert_called_once()

def test_pipeline_selects_real_vlm(mock_ocr, dummy_image):
    Config.USE_VLM = True
    Config.VLM_PROVIDER = "real"
    
    pipeline = OCRPipeline()
    
    with patch("src.ai.vlm.MockVLMExtractor") as MockVLM, \
         patch("src.ai.vlm.RealVLMExtractor") as RealVLM, \
         patch("src.pipeline.extract_fields") as mock_extract:
         
        mock_extract.return_value.fields = MagicMock()
        mock_extract.return_value.model_dump_json.return_value = "{}"
         
        pipeline.process_image(dummy_image, save_debug=False)
        
        RealVLM.assert_called_once()
        MockVLM.assert_not_called()
        RealVLM.return_value.extract.assert_called_once()

def test_pipeline_handles_unknown_provider(mock_ocr, dummy_image):
    Config.USE_VLM = True
    Config.VLM_PROVIDER = "unknown_provider_123"
    
    pipeline = OCRPipeline()
    
    with patch("src.ai.vlm.MockVLMExtractor") as MockVLM, \
         patch("src.ai.vlm.RealVLMExtractor") as RealVLM, \
         patch("src.pipeline.extract_fields") as mock_extract:
         
        mock_extract.return_value.fields = MagicMock()
        mock_extract.return_value.model_dump_json.return_value = "{}"
         
        pipeline.process_image(dummy_image, save_debug=False)
        
        # Unknown provider should fall back safely to mock as per existing project conventions.
        MockVLM.assert_called_once()
        RealVLM.assert_not_called()
