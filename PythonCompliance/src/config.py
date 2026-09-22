import os

class Config:
    # VLM Integration
    USE_VLM = os.environ.get("USE_VLM", "false").lower() == "true"
    VLM_PROVIDER = os.environ.get("VLM_PROVIDER", "mock")

    # OCR Settings
    USE_GPU = True
    OCR_LANG = 'en'
    
    # Preprocessing
    TARGET_IMAGE_SIZE = (1024, 1024) # Used for resizing if image is too large
    
    # Debugging
    DEBUG_MODE = True
    OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "outputs")

# Ensure output dir exists
os.makedirs(Config.OUTPUT_DIR, exist_ok=True)
