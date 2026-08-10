#!/usr/bin/env python3
"""Extract BNCC Arte skills for Ensino Fundamental — Anos Finais (6º-9º) from the
official MEC PDF.

Confirmed by inspecting the PDF's own vector table rules: this section uses the
same mirrored unit/objeto <-> habilidade row structure as Matemática (row
y-boundaries shared between the two pages of a pair). Unlike Matemática, a
single page pair can hold more than one unidade temática (short units like
Dança fit alongside Artes Visuais on the same pair), so the unit is tracked
per-row with carry-forward, the same way the objeto text is on each Matemática
row. All Anos Finais Arte skills share a single consolidated grade code
(EF69AR..) — confirmed by scanning every code in the section before writing
this extractor; there is no per-grade or grade-pair variant here.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

from bncc_extract_common import (
    PDF_URL,
    SOURCE_URL,
    SOURCE_VERSION,
    clean_text,
    download_pdf,
    find_heading_page,
    table_boundaries,
    table_bottom,
)

SECTION_HEADING = "ARTE – 6º AO 9º ANO"
END_MARKER = "4.1.3"  # start of Educação Física

CODE_PATTERN = re.compile(r"\((EF69AR\d{2})\)\s*(.*?)(?=\(EF69AR\d{2}\)|\Z)", re.S)
ANO_LABEL = "6º ao 9º ano"
ANOS_APLICAVEIS = ["6º ano", "7º ano", "8º ano", "9º ano"]


def extract_pair(document: pymupdf.Document, unit_index: int, skill_index: int) -> list[dict]:
    unit_page = document[unit_index]
    skill_page = document[skill_index]
    boundaries = table_boundaries(unit_page)
    # Append a synthetic closing edge instead of overwriting boundaries[-1] —
    # see extract_lingua_portuguesa.py for why replacing it is unsafe.
    page_edge = table_bottom(skill_page)
    if page_edge > boundaries[-1]:
        boundaries.append(page_edge)
    records: list[dict] = []
    current_unit = extract_pair.current_unit

    for top, bottom in zip(boundaries, boundaries[1:]):
        unit_text = clean_text(unit_page.get_textbox(pymupdf.Rect(62, top + 1, 291.5, bottom - 1)))
        if unit_text:
            current_unit = unit_text.title() if unit_text.isupper() else unit_text
        object_text = clean_text(
            unit_page.get_textbox(pymupdf.Rect(292, top + 1, 552.4, bottom - 1)),
            preserve_lines=True,
        )
        skills_text = skill_page.get_textbox(pymupdf.Rect(40, top + 1, 536, bottom - 1))

        if not current_unit:
            raise ValueError(f"No unidade temática established before page {unit_index + 1}, row {top}-{bottom}")

        for code, skill in CODE_PATTERN.findall(skills_text):
            records.append(
                {
                    "codigo": code,
                    "etapa": "Ensino Fundamental",
                    "segmento": "Anos Finais",
                    "area": "Linguagens",
                    "componente": "Arte",
                    "ano": ANO_LABEL,
                    "anos_aplicaveis": ANOS_APLICAVEIS,
                    "unidade_tematica": current_unit,
                    "objeto_conhecimento": object_text,
                    "habilidade": clean_text(skill),
                    "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
                    "fonte_url": SOURCE_URL,
                    "documento_url": PDF_URL,
                    "versao_fonte": SOURCE_VERSION,
                    "pagina_fonte": skill_index,
                    "classificacao": "dado_oficial",
                }
            )

    extract_pair.current_unit = current_unit
    return records


extract_pair.current_unit = None  # type: ignore[attr-defined]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()

    if args.download:
        download_pdf(args.pdf)
    if not args.pdf.exists():
        raise FileNotFoundError(f"Official PDF not found: {args.pdf}")

    document = pymupdf.open(args.pdf)
    start = find_heading_page(document, SECTION_HEADING)
    end = find_heading_page(document, END_MARKER, start=start)

    records: list[dict] = []
    for unit_index in range(start, end, 2):
        skill_index = unit_index + 1
        if skill_index >= end:
            break
        records.extend(extract_pair(document, unit_index, skill_index))

    seen = set()
    for record in records:
        if record["codigo"] in seen:
            raise ValueError(f"Duplicate code extracted: {record['codigo']}")
        seen.add(record["codigo"])
    if not records:
        raise ValueError("No records extracted — check section boundaries")

    imported_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload = {
        "metadata": {
            "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
            "fonte_url": SOURCE_URL,
            "documento_url": PDF_URL,
            "versao_fonte": SOURCE_VERSION,
            "metodo_extracao": "PDF oficial; associação por linhas vetoriais das tabelas em páginas espelhadas (mesma técnica de Matemática), unidade temática com herança por linha e entre pares de página",
            "data_extracao": imported_at,
            "escopo": "Ensino Fundamental — Anos Finais — Arte — 6º ao 9º ano (código único EF69AR, sem variação por ano)",
            "classificacao": "dado_oficial",
        },
        "habilidades": records,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(records), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
