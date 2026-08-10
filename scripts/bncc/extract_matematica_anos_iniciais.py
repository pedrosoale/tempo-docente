#!/usr/bin/env python3
"""Extract BNCC Mathematics skills for grades 1-5 from the official MEC PDF.

Same technique as extract_official.py (grades 6-9): the official PDF presents
each curriculum table as a two-page spread, units/objects on the left page,
skills on the right page. Row boundaries come from the table's own vector
lines. It never rewrites official skill text.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

PDF_URL = "https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf"
SOURCE_URL = "https://basenacionalcomum.mec.gov.br/abase/"
SOURCE_VERSION = "BNCC Educação Infantil e Ensino Fundamental — versão final de 11/05/2018"

# Zero-based PDF indices. Each tuple is (units/objects page, skills page).
PAGE_PAIRS = {
    1: [(279, 280), (281, 282)],
    2: [(283, 284), (285, 286)],
    3: [(287, 288), (289, 290)],
    4: [(291, 292), (293, 294)],
    5: [(295, 296), (297, 298)],
}

CODE_PATTERN = re.compile(r"\((EF0[1-5]MA\d{2})\)\s*(.*?)(?=\(EF0[1-5]MA\d{2}\)|\Z)", re.S)

# Documented, code-specific typography corrections go here if PyMuPDF is
# found to flatten a glyph for one of these codes (same pattern as
# extract_official.py). None known yet for 1º-5º ano — verify against the
# official spreadsheet export before adding any entry.
CONTROLLED_TYPOGRAPHY_CORRECTIONS: dict[str, dict[str, tuple[tuple[str, str], ...]]] = {}


def clean_text(value: str, preserve_lines: bool = False) -> str:
    value = unicodedata.normalize("NFC", value.replace("­", ""))
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines) if preserve_lines else " ".join(lines)


def restore_official_typography(record: dict) -> dict:
    for field, replacements in CONTROLLED_TYPOGRAPHY_CORRECTIONS.get(record["codigo"], {}).items():
        for flattened, official in replacements:
            record[field] = record[field].replace(flattened, official)
    return record


def table_boundaries(page: pymupdf.Page) -> list[float]:
    values: list[float] = []
    for drawing in page.get_drawings():
        for item in drawing["items"]:
            if item[0] != "l":
                continue
            start, end = item[1], item[2]
            if abs(start.y - end.y) > 0.2:
                continue
            left, right = sorted((start.x, end.x))
            if left <= 292 and right >= 552 and 150 <= start.y <= 790:
                values.append(round(start.y, 2))
    boundaries = sorted(set(values))
    if len(boundaries) < 2:
        raise ValueError(f"Table boundaries not found on PDF page {page.number + 1}")
    return boundaries


def extract_pair(document: pymupdf.Document, grade: int, unit_index: int, skill_index: int) -> list[dict]:
    unit_page = document[unit_index]
    skill_page = document[skill_index]
    boundaries = table_boundaries(unit_page)
    # The table's true bottom edge is sometimes not drawn as a full-width
    # line, leaving real trailing rows outside every detected boundary. Add a
    # synthetic closing edge at the page height instead of overwriting the
    # last *detected* boundary — that boundary is a real internal divider
    # between the last two rows, and replacing it merges them (confirmed:
    # doing so merged EF04MA27's and EF04MA28's distinct objeto_conhecimento
    # into one, silently duplicating text across both records).
    page_edge = skill_page.rect.height - 40
    if page_edge > boundaries[-1]:
        boundaries.append(page_edge)
    records: list[dict] = []
    current_unit = ""

    for top, bottom in zip(boundaries, boundaries[1:]):
        unit_text = clean_text(unit_page.get_textbox(pymupdf.Rect(62, top + 1, 291.5, bottom - 1)))
        if unit_text:
            current_unit = unit_text

        object_text = clean_text(
            unit_page.get_textbox(pymupdf.Rect(292, top + 1, 552.4, bottom - 1)),
            preserve_lines=True,
        )
        skills_text = clean_text(skill_page.get_textbox(pymupdf.Rect(50, top + 1, 536, bottom - 1)))

        if not object_text and not skills_text:
            continue
        if not current_unit or not object_text:
            raise ValueError(
                f"Incomplete curriculum row on PDF pages {unit_index + 1}/{skill_index + 1}: "
                f"unit={current_unit!r}, object={object_text!r}"
            )

        matches = CODE_PATTERN.findall(skills_text)
        if not matches:
            raise ValueError(
                f"No skill codes found in row {top:.2f}-{bottom:.2f} on PDF page {skill_index + 1}"
            )

        for code, skill in matches:
            records.append(
                {
                    "codigo": code,
                    "etapa": "Ensino Fundamental",
                    "segmento": "Anos Iniciais",
                    "area": "Matemática",
                    "componente": "Matemática",
                    "ano": f"{grade}º ano",
                    "anos_aplicaveis": [f"{grade}º ano"],
                    "unidade_tematica": current_unit,
                    "objeto_conhecimento": object_text,
                    "habilidade": clean_text(skill),
                    "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
                    "fonte_url": SOURCE_URL,
                    "documento_url": PDF_URL,
                    "versao_fonte": SOURCE_VERSION,
                    "pagina_fonte": skill_index - 1,
                    "classificacao": "dado_oficial",
                }
            )

    return records


def download_pdf(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(PDF_URL, headers={"User-Agent": "TempoDocente-BNCC-Importer/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response, destination.open("wb") as output:
        output.write(response.read())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True, help="Path to the official MEC PDF")
    parser.add_argument("--output", type=Path, required=True, help="Output source snapshot JSON")
    parser.add_argument("--download", action="store_true", help="Download the official PDF before extracting")
    args = parser.parse_args()

    if args.download:
        download_pdf(args.pdf)
    if not args.pdf.exists():
        raise FileNotFoundError(f"Official PDF not found: {args.pdf}")

    document = pymupdf.open(args.pdf)
    records: list[dict] = []
    for grade, pairs in PAGE_PAIRS.items():
        for unit_index, skill_index in pairs:
            records.extend(extract_pair(document, grade, unit_index, skill_index))
    records = [restore_official_typography(record) for record in records]

    imported_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload = {
        "metadata": {
            "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
            "fonte_url": SOURCE_URL,
            "documento_url": PDF_URL,
            "versao_fonte": SOURCE_VERSION,
            "metodo_extracao": "PDF oficial; associação por linhas vetoriais das tabelas em páginas espelhadas",
            "data_extracao": imported_at,
            "escopo": "Ensino Fundamental — Anos Iniciais — Matemática — 1º ao 5º ano",
            "classificacao": "dado_oficial",
            "correcoes_tipograficas_controladas": [],
        },
        "habilidades": records,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(records), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
