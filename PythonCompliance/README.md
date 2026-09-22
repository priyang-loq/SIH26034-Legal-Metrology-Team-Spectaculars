# Legal Metrology OCR Pipeline

This project provides a production-ready OCR pipeline for extracting structured fields (MRP, Net Quantity, Dates) from product labels using PaddleOCR and an RTX 4050 GPU.

## Architecture

```text
Image -> Preprocessing -> PaddleOCR (GPU) -> Normalization -> Rule-based Extraction -> Structured JSON
```

- **Preprocessing**: Grayscale and adaptive thresholding are used as fallback mechanisms if standard OCR extraction yields low confidence.
- **OCR Engine**: PaddleOCR using standard multilingual models, strictly verified to run on the CUDA device.
- **Extraction**: Pydantic-validated models process regex and spatial rules for reliable field extraction.

## Requirements

- Python 3.11.9
- NVIDIA GPU (RTX 4050 or similar)
- CUDA-compatible driver (e.g. 13.3)
- PaddlePaddle (>=3.3.1)
- PaddleOCR (>=3.7.0)

## Environment Setup

The environment uses `D:\PRIYADIP\.venv`. If recreating:

1. Create a virtual environment:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies:
```powershell
python -m pip install -r requirements.txt
```

Note: `paddlepaddle-gpu` installation on Windows can be tricky. It was manually verified to run on GPU 0.
To verify GPU inference, check the logs for:
`gpu_resources.cc:116] Please NOTE: device: 0, GPU Compute Capability: 8.9`

## Running the Pipeline

To run the pipeline on an image:

```powershell
python scripts/run_pipeline.py --image path/to/your/image.jpg
```

This will:
1. Print the extracted JSON to the console.
2. Save debug images (showing OCR bounding boxes and Extracted Field bounding boxes) to `data/outputs/`.

To disable debug image generation:
```powershell
python scripts/run_pipeline.py --image path/to/your/image.jpg --no-debug
```

## Running Tests

To verify the extraction rules:

```powershell
pytest tests/
```

## Troubleshooting

- **GPU Fallback to CPU**: If the terminal logs `PaddlePaddle is not compiled with CUDA! Falling back to CPU.`, ensure your `paddlepaddle-gpu` version matches your installed CUDA driver. For Windows, refer to the [PaddlePaddle Installation Guide](https://www.paddlepaddle.org.cn/install/quick?docurl=/documentation/docs/en/install/pip/windows-pip_en.html).
- **Missing DLLs**: If PaddleOCR throws DLL load failed errors on Windows, you may need to install the Microsoft Visual C++ Redistributable.

## Future Extension Points

- Add more fields (Manufacturer, FSSAI) to `src/extract/schema.py` and `src/extract/rules.py`.
- Integrate a layout-analysis model (like PP-Structure) if tables are frequently encountered.
- The output JSON is currently printed to stdout but can be sent directly to the Legal Metrology rule engine API.
