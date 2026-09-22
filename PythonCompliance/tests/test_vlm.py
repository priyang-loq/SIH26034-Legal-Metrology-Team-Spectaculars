import os
import pytest
from unittest import mock
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.ai.vlm import RealVLMExtractor

def test_real_vlm_requires_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    extractor = RealVLMExtractor()
    with pytest.raises(ValueError, match="GEMINI_API_KEY environment variable is not set"):
        extractor.extract("dummy.jpg", "dummy_ocr_data")

@mock.patch("google.genai.Client")
@mock.patch("PIL.Image.open")
def test_real_vlm_api_call_structure(mock_image_open, mock_client, monkeypatch):
    # This test verifies that we initialize the client correctly,
    # pass the image, and configure response_mime_type="application/json"
    monkeypatch.setenv("GEMINI_API_KEY", "fake_test_key")
    
    # Mock the client response
    mock_response = mock.Mock()
    mock_response.text = '{"product_name": {"value": "Test", "status": "FOUND", "confidence": 0.9}}'
    
    mock_models = mock.Mock()
    mock_models.generate_content.return_value = mock_response
    
    mock_client_instance = mock.Mock()
    mock_client_instance.models = mock_models
    mock_client.return_value = mock_client_instance
    
    extractor = RealVLMExtractor()
    result = extractor.extract("dummy.jpg", "fake_ocr")
    
    # Assert Client initialized with correct key and timeout
    mock_client.assert_called_once_with(api_key="fake_test_key", http_options={'timeout': 60000})
    
    # Assert generate_content was called with gemini-3.6-flash
    args, kwargs = mock_models.generate_content.call_args
    assert kwargs["model"] == "gemini-3.5-flash"
    
    # Assert the correct config was passed
    config = kwargs["config"]
    assert config.response_mime_type == "application/json"
    
    # Assert JSON was extracted
    assert result["product_name"]["value"] == "Test"

def test_real_vlm_retries_on_readtimeout(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake_test_key")
    
    class MockReadTimeout(Exception):
        pass
        
    mock_response = mock.Mock()
    mock_response.text = '{"product_name": {"value": "Test", "status": "FOUND", "confidence": 0.9}}'
    
    with mock.patch("google.genai.Client") as mock_client, \
         mock.patch("PIL.Image.open"), \
         mock.patch("time.sleep") as mock_sleep:
             
        mock_models = mock.Mock()
        # First call raises ReadTimeout, second call succeeds
        mock_models.generate_content.side_effect = [
            MockReadTimeout("The read operation timed out"),
            mock_response
        ]
        
        mock_client_instance = mock.Mock()
        mock_client_instance.models = mock_models
        mock_client.return_value = mock_client_instance
        
        extractor = RealVLMExtractor()
        result = extractor.extract("dummy.jpg", "fake_ocr")
        
        # Should have called generate_content twice
        assert mock_models.generate_content.call_count == 2
        # Should have slept once for 2 seconds (first backoff)
        mock_sleep.assert_called_once_with(2)
        # Should have extracted correctly
        assert result["product_name"]["value"] == "Test"
