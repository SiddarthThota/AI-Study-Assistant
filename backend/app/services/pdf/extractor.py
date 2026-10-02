from __future__ import annotations

from io import BytesIO
from typing import Any

from pypdf import PdfReader


MAX_PDF_BYTES = 20 * 1024 * 1024
MAX_PDF_PAGES = 200
MAX_EXTRACTED_CHARACTERS = 100_000
MIN_EXTRACTED_CHARACTERS = 40


class PDFExtractionError(ValueError):
    pass


def extract_pdf_text(payload: bytes) -> tuple[str, int]:
    if not payload:
        raise PDFExtractionError("The uploaded PDF is empty")
    if len(payload) > MAX_PDF_BYTES:
        raise PDFExtractionError("The PDF exceeds the 20 MB upload limit")
    if not payload.startswith(b"%PDF-"):
        raise PDFExtractionError("The uploaded file is not a valid PDF")

    try:
        reader: Any = PdfReader(BytesIO(payload), strict=True)
        if reader.is_encrypted:
            raise PDFExtractionError("Encrypted PDFs are not supported")
        page_count = len(reader.pages)
    except PDFExtractionError:
        raise
    except Exception as exc:
        raise PDFExtractionError("The PDF could not be opened") from exc

    if page_count == 0:
        raise PDFExtractionError("The PDF contains no pages")
    if page_count > MAX_PDF_PAGES:
        raise PDFExtractionError(f"The PDF exceeds the {MAX_PDF_PAGES}-page limit")

    extracted_pages: list[str] = []
    character_count = 0
    try:
        for page_number, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            if not text:
                continue
            character_count += len(text)
            if character_count > MAX_EXTRACTED_CHARACTERS:
                raise PDFExtractionError("The extracted PDF text exceeds the 100,000-character limit")
            extracted_pages.append(f"[Page {page_number}]\n{text}")
    except PDFExtractionError:
        raise
    except Exception as exc:
        raise PDFExtractionError("Text could not be extracted from the PDF") from exc

    source_text = "\n\n".join(extracted_pages).strip()
    if len(source_text) < MIN_EXTRACTED_CHARACTERS:
        raise PDFExtractionError(
            "This PDF has no usable selectable text. Scanned/image-only PDFs require OCR and are not supported."
        )

    return source_text, page_count
