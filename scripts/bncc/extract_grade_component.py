#!/usr/bin/env python3
"""Extract BNCC skills for Ensino Fundamental — Anos Finais (6º-9º) for
components that use a single-grade-per-code pattern (EF0XCOMP..), the same
convention as Matemática: Ciências, Geografia, História.

Grade is read directly from each code's own digits rather than tracked via
page headings — the official document occasionally spills a grade's table
onto a "(Continuação)" page-pair, which would make heading-based grade
tracking fragile. Unidade temática is tracked with row-level carry-forward
across the whole Anos Finais range, the same technique used for Arte —
confirmed necessary because more than one unidade can share a page here too.
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

GRADE_TO_LABEL = {"06": "6º ano", "07": "7º ano", "08": "8º ano", "09": "9º ano"}


def extract_pair(unit_page: pymupdf.Page, skill_page: pymupdf.Page, current_unit: str | None, code_pattern: re.Pattern, area: str, componente: str) -> tuple[list[dict], str | None]:
    boundaries = table_boundaries(unit_page)
    # Append a synthetic closing edge instead of overwriting boundaries[-1] —
    # see extract_lingua_portuguesa.py for why replacing it is unsafe.
    page_edge = table_bottom(skill_page)
    if page_edge > boundaries[-1]:
        boundaries.append(page_edge)
    records: list[dict] = []

    for top, bottom in zip(boundaries, boundaries[1:]):
        unit_text = clean_text(unit_page.get_textbox(pymupdf.Rect(62, top + 1, 291.5, bottom - 1)))
        if unit_text:
            current_unit = unit_text
        # One row can list several objetos together (e.g. Ciências groups every
        # objeto of a unidade into a single tall row spanning many habilidades).
        # Capture the row's full object text rather than picking one — every
        # habilidade in that row shares that same full set in the official table.
        object_text = clean_text(
            unit_page.get_textbox(pymupdf.Rect(292, top + 1, 552.4, bottom - 1)),
            preserve_lines=True,
        )
        skills_text = skill_page.get_textbox(pymupdf.Rect(40, top + 1, 536, bottom - 1))

        if not current_unit:
            raise ValueError(f"No unidade temática established before page {unit_page.number + 1}, row {top}-{bottom}")

        for code, skill in code_pattern.findall(skills_text):
            grade_key = code[2:4]
            if grade_key not in GRADE_TO_LABEL:
                continue  # Anos Iniciais leakage guard; should not happen within our page range
            records.append(
                {
                    "codigo": code,
                    "etapa": "Ensino Fundamental",
                    "segmento": "Anos Finais",
                    "area": area,
                    "componente": componente,
                    "ano": GRADE_TO_LABEL[grade_key],
                    "anos_aplicaveis": [GRADE_TO_LABEL[grade_key]],
                    "unidade_tematica": current_unit,
                    "objeto_conhecimento": object_text,
                    "habilidade": clean_text(skill),
                    "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
                    "fonte_url": SOURCE_URL,
                    "documento_url": PDF_URL,
                    "versao_fonte": SOURCE_VERSION,
                    "pagina_fonte": skill_page.number,
                    "classificacao": "dado_oficial",
                }
            )

    return records, current_unit


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--start-heading", required=True, help='e.g. "CIÊNCIAS – 6º ANO"')
    parser.add_argument("--end-marker", required=True, help='e.g. "4.4" (next major section number)')
    parser.add_argument("--code-prefix", required=True, help='2-4 letter component code, e.g. "CI"')
    parser.add_argument("--area", required=True)
    parser.add_argument("--componente", required=True)
    parser.add_argument("--escopo-note", default="")
    args = parser.parse_args()

    if args.download:
        download_pdf(args.pdf)
    if not args.pdf.exists():
        raise FileNotFoundError(f"Official PDF not found: {args.pdf}")

    code_pattern = re.compile(rf"\((EF0[6-9]{args.code_prefix}\d{{2}})\)\s*(.*?)(?=\(EF0[6-9]{args.code_prefix}\d{{2}}\)|\Z)", re.S)

    document = pymupdf.open(args.pdf)
    start = find_heading_page(document, args.start_heading)
    end = find_heading_page(document, args.end_marker, start=start)

    records: list[dict] = []
    current_unit: str | None = None
    for unit_index in range(start, end, 2):
        skill_index = unit_index + 1
        if skill_index >= end:
            break
        pair_records, current_unit = extract_pair(document[unit_index], document[skill_index], current_unit, code_pattern, args.area, args.componente)
        records.extend(pair_records)

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
            "metodo_extracao": "PDF oficial; associação por linhas vetoriais das tabelas em páginas espelhadas (mesma técnica de Matemática/Arte); ano derivado diretamente do código, não da posição de página, por robustez a páginas de continuação",
            "data_extracao": imported_at,
            "escopo": f"Ensino Fundamental — Anos Finais — {args.componente} — 6º ao 9º ano" + (f" ({args.escopo_note})" if args.escopo_note else ""),
            "classificacao": "dado_oficial",
        },
        "habilidades": records,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(records), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
