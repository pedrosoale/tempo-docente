"""Shared helpers for BNCC Ensino Fundamental — Anos Finais extractors.

Kept deliberately small: text cleanup, heading search, and controlled-correction
application are the only truly generic steps across components. Table layout,
code patterns, and unit/campo detection differ enough per component (confirmed by
reading the real PDF pages, not assumed) that each extractor keeps its own logic.
"""

from __future__ import annotations

import re
import unicodedata
import urllib.request
from pathlib import Path

import pymupdf

PDF_URL = "https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf"
SOURCE_URL = "https://basenacionalcomum.mec.gov.br/abase/"
SOURCE_VERSION = "BNCC Educação Infantil e Ensino Fundamental — versão final de 11/05/2018"


def clean_text(value: str, preserve_lines: bool = False) -> str:
    value = unicodedata.normalize("NFC", value.replace("­", ""))
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines) if preserve_lines else " ".join(lines)


def find_heading_page(document: pymupdf.Document, heading: str, start: int = 0) -> int:
    for page in document:
        if page.number < start:
            continue
        if heading in page.get_text().upper().replace("\n", " "):
            return page.number
    raise ValueError(f"Heading {heading!r} not found from page {start}")


def table_boundaries(page: pymupdf.Page, min_count: int = 2) -> list[float]:
    """Row y-boundaries shared by a mirrored unit/objeto <-> habilidade page pair.

    Relies on the PDF's own vector table rules, exactly like the original
    Matemática extractor — never guessed, always read from the page's drawings.
    """
    values: list[float] = []
    for drawing in page.get_drawings():
        for item in drawing["items"]:
            if item[0] != "l":
                continue
            start, end = item[1], item[2]
            if abs(start.y - end.y) > 0.2:
                continue
            left, right = sorted((start.x, end.x))
            # The object column's row-divider is the reliable, consistently-present
            # signal across components (the unit column's divider is often merged
            # across multi-row units instead). Coordinates vary by a fraction of a
            # point between sections, so match with a small tolerance rather than
            # an exact threshold.
            if left <= 293 and right >= 550.5 and 150 <= start.y <= 790:
                values.append(round(start.y, 2))
    boundaries = sorted(set(values))
    if len(boundaries) < min_count:
        raise ValueError(f"Table boundaries not found on PDF page {page.number + 1}")
    return boundaries


def column_text(page: pymupdf.Page, min_x: float, max_x: float, top: float, bottom: float) -> str:
    """Text of lines whose own left edge falls within [min_x, max_x], not lines
    merely overlapping that x-range.

    page.get_textbox(rect) clips by character/span overlap with the rect, which
    lets a long, wide paragraph line from an adjacent column bleed a trailing
    fragment across a narrow column gap (confirmed on a Língua Portuguesa page
    where a campo's intro paragraph — set in the left column — leaked word
    fragments into the right-column objeto de conhecimento text once its lines
    ran close to the column boundary). Filtering by each line's own x0 avoids
    that leakage regardless of how close the columns sit.
    """
    lines: list[str] = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            x0, y0 = line["bbox"][0], line["bbox"][1]
            if top <= y0 < bottom and min_x <= x0 <= max_x:
                text = "".join(span["text"] for span in line["spans"])
                if text.strip():
                    lines.append(text)
    return "\n".join(lines)


def table_bottom(page: pymupdf.Page) -> float:
    values: list[float] = []
    for drawing in page.get_drawings():
        for item in drawing["items"]:
            if item[0] != "l":
                continue
            start, end = item[1], item[2]
            if abs(start.y - end.y) <= 0.2 and abs(start.x - end.x) >= 400 and 150 <= start.y <= 790:
                values.append(round(start.y, 2))
    if not values:
        raise ValueError(f"Table bottom not found on PDF page {page.number + 1}")
    return max(values)


def download_pdf(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(PDF_URL, headers={"User-Agent": "TempoDocente-BNCC-Importer/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response, destination.open("wb") as output:
        output.write(response.read())
