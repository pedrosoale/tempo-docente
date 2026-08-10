#!/usr/bin/env python3
"""Extract BNCC Educação Física skills for Ensino Fundamental — Anos Finais
(6º-9º) from the official MEC PDF.

Same mirrored table structure as Arte (vector row boundaries, multiple short
unidades temáticas per page pair, unit tracked with row-level carry-forward).
Unlike Arte, this component has two grade-paired subsections rather than one
consolidated code: EF67EF.. ("6º e 7º anos") and EF89EF.. ("8º e 9º anos") —
confirmed by scanning every code in the section before writing this extractor;
there are no single-grade codes here at all.
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

SUBSECTIONS = [
    ("EDUCAÇÃO FÍSICA – 6º E 7º ANOS", "67", "6º e 7º ano", ["6º ano", "7º ano"]),
    ("EDUCAÇÃO FÍSICA – 8º E 9º ANOS", "89", "8º e 9º ano", ["8º ano", "9º ano"]),
]
END_MARKER = "4.1.4"  # start of Língua Inglesa


def extract_pair(unit_page: pymupdf.Page, skill_page: pymupdf.Page, current_unit: str | None, grade_key: str, ano: str, anos_aplicaveis: list[str], code_pattern: re.Pattern, segmento: str) -> tuple[list[dict], str | None]:
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
        object_text = clean_text(
            unit_page.get_textbox(pymupdf.Rect(292, top + 1, 552.4, bottom - 1)),
            preserve_lines=True,
        )
        skills_text = skill_page.get_textbox(pymupdf.Rect(40, top + 1, 536, bottom - 1))

        if not current_unit:
            raise ValueError(f"No unidade temática established before page {unit_page.number + 1}, row {top}-{bottom}")

        for code, skill in code_pattern.findall(skills_text):
            if code[2:4] != grade_key:
                continue  # belongs to the other subsection's leftover text on a shared row, if any
            records.append(
                {
                    "codigo": code,
                    "etapa": "Ensino Fundamental",
                    "segmento": segmento,
                    "area": "Linguagens",
                    "componente": "Educação Física",
                    "ano": ano,
                    "anos_aplicaveis": anos_aplicaveis,
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
    parser.add_argument("--heading1", default=SUBSECTIONS[0][0])
    parser.add_argument("--grade-key1", default=SUBSECTIONS[0][1])
    parser.add_argument("--ano1", default=SUBSECTIONS[0][2])
    parser.add_argument("--anos-aplicaveis1", default=",".join(SUBSECTIONS[0][3]))
    parser.add_argument("--heading2", default=SUBSECTIONS[1][0])
    parser.add_argument("--grade-key2", default=SUBSECTIONS[1][1])
    parser.add_argument("--ano2", default=SUBSECTIONS[1][2])
    parser.add_argument("--anos-aplicaveis2", default=",".join(SUBSECTIONS[1][3]))
    parser.add_argument("--end-marker", default=END_MARKER)
    parser.add_argument("--segmento", default="Anos Finais")
    parser.add_argument("--escopo-nota", default="6º ao 9º ano (códigos pareados EF67EF/EF89EF, sem variação por ano único)")
    args = parser.parse_args()

    if args.download:
        download_pdf(args.pdf)
    if not args.pdf.exists():
        raise FileNotFoundError(f"Official PDF not found: {args.pdf}")

    subsections = [
        (args.heading1, args.grade_key1, args.ano1, args.anos_aplicaveis1.split(",")),
        (args.heading2, args.grade_key2, args.ano2, args.anos_aplicaveis2.split(",")),
    ]
    grade_keys = "|".join(re.escape(key) for key in (args.grade_key1, args.grade_key2))
    code_pattern = re.compile(rf"\((EF(?:{grade_keys})EF\d{{2}})\)\s*(.*?)(?=\(EF(?:{grade_keys})EF\d{{2}}\)|\Z)", re.S)

    document = pymupdf.open(args.pdf)
    starts = [find_heading_page(document, heading) for heading, *_ in subsections]
    end = find_heading_page(document, args.end_marker, start=starts[-1])
    bounds = list(zip(starts, starts[1:] + [end]))

    records: list[dict] = []
    for (heading, grade_key, ano, anos_aplicaveis), (start, section_end) in zip(subsections, bounds):
        current_unit: str | None = None
        for unit_index in range(start, section_end, 2):
            skill_index = unit_index + 1
            if skill_index >= section_end:
                break
            pair_records, current_unit = extract_pair(
                document[unit_index], document[skill_index], current_unit, grade_key, ano, anos_aplicaveis, code_pattern, args.segmento,
            )
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
            "metodo_extracao": "PDF oficial; associação por linhas vetoriais das tabelas em páginas espelhadas (mesma técnica de Matemática/Arte), unidade temática com herança por linha",
            "data_extracao": imported_at,
            "escopo": f"Ensino Fundamental — {args.segmento} — Educação Física — {args.escopo_nota}",
            "classificacao": "dado_oficial",
        },
        "habilidades": records,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(records), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
