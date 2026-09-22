import argparse
import sys
import os

# Add the project root to the python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.pipeline import OCRPipeline

def main():
    if sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description="Run the Legal Metrology OCR Pipeline")
    parser.add_argument("--image", required=True, help="Path to the product image")
    parser.add_argument("--no-debug", action="store_true", help="Disable saving debug images")
    
    args = parser.parse_args()
    
    pipeline = OCRPipeline()
    try:
        json_result = pipeline.process_image(args.image, save_debug=not args.no_debug)
        print("\n--- EXTRACTION RESULT ---")
        print(json_result)
    except Exception as e:
        print(f"Error processing image: {e}")

if __name__ == "__main__":
    main()
