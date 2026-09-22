import sys
import os
import json
import logging
import time
from abc import ABC, abstractmethod
from typing import Dict, Any

logger = logging.getLogger(__name__)

class VLMExtractor(ABC):
    @abstractmethod
    def extract(self, image_path: str, ocr_data: Any) -> Dict[str, Any]:
        pass

class MockVLMExtractor(VLMExtractor):
    def extract(self, image_path: str, ocr_data: Any) -> Dict[str, Any]:
        # Return deterministic mock responses for testing
        if "product01" in image_path:
            return {
                "manufacturer": {
                    "name": {
                        "value": "ABC Food Co",
                        "confidence": 0.95,
                        "status": "FOUND",
                        "evidence": ["ABC Food Co"]
                    },
                    "address": {
                        "value": "Some City, India",
                        "confidence": 0.9,
                        "status": "FOUND",
                        "evidence": ["Some City", "India"]
                    }
                },
                "product_name": {
                    "value": "Test Premium Biscuits",
                    "confidence": 0.99,
                    "status": "FOUND",
                    "evidence": ["Test Premium Biscuits"]
                }
            }
        elif "product02" in image_path:
            return {
                "net_quantity": {
                    "value": "510 g",
                    "confidence": 0.96,
                    "status": "FOUND",
                    "evidence": ["510g"]
                }
            }
        return {}

class RealVLMExtractor(VLMExtractor):
    def extract(self, image_path: str, ocr_data: Any) -> Dict[str, Any]:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set. Please configure it to use RealVLMExtractor.")
            
        from google import genai
        import PIL.Image
        
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        from src.ai.prompts import VLM_SYSTEM_PROMPT
        
        import socket
        # Ensure fast IPv4 resolution for Google endpoints to avoid broken IPv6 NAT64 blackholes
        try:
            _orig_getaddrinfo = socket.getaddrinfo
            def _getaddrinfo_prefer_ipv4(host, port, family=0, *args, **kwargs):
                if host and ("google" in str(host) or "generativelanguage" in str(host)):
                    return _orig_getaddrinfo(host, port, socket.AF_INET, *args, **kwargs)
                return _orig_getaddrinfo(host, port, family, *args, **kwargs)
            socket.getaddrinfo = _getaddrinfo_prefer_ipv4
        except Exception:
            pass

        import httpx
        custom_http = httpx.Client(timeout=httpx.Timeout(10.0, connect=5.0))
        client = genai.Client(api_key=api_key, http_options=genai.types.HttpOptions(httpx_client=custom_http))
        
        img = PIL.Image.open(image_path)
        
        prompt = f"""
        {VLM_SYSTEM_PROMPT}
        
        OCR CONTEXT:
        {ocr_data}
        """
        
        max_retries = 1
        backoff_delays = [2]
        response = None
        
        for attempt in range(1, max_retries + 2):
            try:
                response = client.models.generate_content(
                    model='gemini-3.5-flash',
                    contents=[img, prompt],
                    config=genai.types.GenerateContentConfig(
                        response_mime_type="application/json",
                        automatic_function_calling=genai.types.AutomaticFunctionCallingConfig(disable=True)
                    )
                )
                break
            except Exception as e:
                err_type = type(e).__name__
                e_msg = str(e)
                if api_key and api_key in e_msg:
                    e_msg = e_msg.replace(api_key, "HIDDEN_API_KEY")
                    
                status_code = getattr(e, 'code', getattr(e, 'status_code', None))
                err_identifier = f"HTTP {status_code}" if status_code else err_type

                is_quota_exhausted = (status_code == 429) or any(k in e_msg.lower() for k in ["429", "quota", "resource_exhausted"])
                if is_quota_exhausted:
                    logger.warning(f"Gemini API quota exhausted ({err_identifier}). Failing fast to OCR/deterministic pipeline.")
                    raise RuntimeError("VLM_UNAVAILABLE")

                is_transient = False
                if status_code in [503, 500, 502, 504]:
                    is_transient = True
                elif any(k in e_msg.lower() for k in ["503", "unavailable", "502", "500", "504", "server error"]):
                    is_transient = True
                elif "timeout" in err_type.lower() or "timeout" in e_msg.lower():
                    is_transient = True
                
                if status_code in [401, 403, 400]:
                    is_transient = False
                elif "api key" in e_msg.lower() or "invalid" in e_msg.lower():
                    is_transient = False
                    
                if not is_transient or attempt > max_retries:
                    logger.error(f"Gemini API request failed after {attempt} attempts ({err_type}): {err_identifier} - {e_msg}")
                    raise RuntimeError("VLM_UNAVAILABLE")
                    
                delay = backoff_delays[attempt - 1]
                logger.warning(f"Gemini attempt {attempt}/{max_retries + 1} failed: {err_identifier}")
                logger.warning(f"Retrying in {delay} seconds...")
                time.sleep(delay)
                
        if not response:
            raise RuntimeError("VLM_UNAVAILABLE")
            
        try:
            text = response.text
            if not text:
                logger.error("Gemini API returned an empty response.text (possibly blocked by safety filters).")
                raise RuntimeError("VLM_UNAVAILABLE")
        except Exception as e:
            logger.error(f"Failed to read response.text ({type(e).__name__}): {str(e)}")
            raise RuntimeError("VLM_UNAVAILABLE")
            
        try:
            # Extract JSON block
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
                
            return json.loads(text.strip())
        except Exception as e:
            logger.error(f"Failed to parse JSON from Gemini response ({type(e).__name__}): {str(e)}")
            logger.error(f"Raw Response Snippet: {text[:500]}")
            raise RuntimeError("VLM_UNAVAILABLE")
