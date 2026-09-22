import os
import sys
import argparse
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.pipeline import OCRPipeline

def main():
    parser = argparse.ArgumentParser(description="Process all images in a folder")
    parser.add_argument("--folder", default="data/test_images", help="Folder containing images to process")
    args = parser.parse_args()

    pipeline = OCRPipeline()
    
    # Find all images recursively in the specified folder
    folder_path = Path(args.folder)
    test_images = []
    for ext in ['*.jpg', '*.jpeg', '*.png']:
        test_images.extend(folder_path.rglob(ext))
    
    if not test_images:
        print(f"No images found in {args.folder}")
        return

    for img_path in test_images:
        print(f"\nProcessing {img_path}...")
        try:
            json_result = pipeline.process_image(str(img_path), save_debug=True)
            
            # Create a unique output name based on the original image name
            out_filename = f"{img_path.stem}.json"
            out_path = Path('data/outputs') / out_filename
            out_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write(json_result)
            print(f"Saved {out_path}")
        except Exception as e:
            print(f"Failed to process {img_path}: {e}")

if __name__ == "__main__":
    main()
