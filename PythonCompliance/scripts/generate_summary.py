import json
import glob
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def main():
    output_files = glob.glob('data/outputs/*.json')
    summary_path = 'data/outputs/summary.md'
    
    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write("# OCR Pipeline Results Summary\n\n")
        
        for file_path in sorted(output_files):
            try:
                with open(file_path, 'r', encoding='utf-8') as jf:
                    data = json.load(jf)
                    
                image_name = os.path.basename(data.get('image_path', file_path))
                f.write(f"## {image_name}\n\n")
                
                ocr_info = data.get('ocr_info', {})
                f.write("### OCR Metadata\n")
                f.write(f"- **Engine**: {ocr_info.get('engine')}\n")
                f.write(f"- **Device**: {ocr_info.get('device')}\n")
                f.write(f"- **Preprocessing Variant**: {ocr_info.get('preprocessing_variant')}\n")
                f.write(f"- **Total Text Blocks Detected**: {len(ocr_info.get('results', []))}\n\n")
                
                f.write("### Extracted Fields\n")
                fields = data.get('fields', {})
                for field_name, field_data in fields.items():
                    status = field_data.get('status')
                    if status not in ['NOT_FOUND', 'INVALID'] or field_data.get('extracted_value'):
                        f.write(f"- **{field_name.upper()}**: {status}\n")
                        if field_data.get('extracted_value'):
                            f.write(f"  - Extracted Value: `{field_data.get('extracted_value')}`\n")
                            if field_data.get('unit'):
                                f.write(f"  - Unit: `{field_data.get('unit')}`\n")
                            f.write(f"  - Source Text: `{field_data.get('source_text')}`\n")
                            f.write(f"  - Evidence Blocks: {len(field_data.get('evidence', []))}\n")
                            f.write(f"  - Extraction Confidence: `{field_data.get('extraction_confidence'):.4f}`\n")
                            
                            bbox = field_data.get('bbox')
                            if bbox and 'points' in bbox:
                                points_str = ", ".join([f"({p[0]}, {p[1]})" for p in bbox['points']])
                                f.write(f"  - Bounding Box: [{points_str}]\n")
                
                f.write("\n---\n\n")
                print(f"Summarized {image_name}")
                
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
                
    print(f"Summary written to {summary_path}")

if __name__ == "__main__":
    main()
