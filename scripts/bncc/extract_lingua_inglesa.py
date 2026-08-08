#!/usr/bin/env python3
"""Extract BNCC Língua Inglesa skills for Ensino Fundamental — Anos Finais
(6º-9º) from the official MEC PDF.

Língua Inglesa is only taught from 6º ano on in the BNCC, so every code in this
section is Anos Finais — no filtering needed. The component organizes by "eixo"
(Oralidade, Leitura, Escrita, Conhecimentos Linguísticos, Dimensão
Intercultural) rather than unidade temática or campo de atuação; confirmed by
reading the actual pages, table rows are shared vector boundaries exactly like
Matemática/Arte/Educação Física, with several short eixos per page pair. Each
grade (6º-9º) repeats the full five-eixo cycle across its own 4 pages, and the
grade is read directly from each code's own digits rather than assumed from
page position.
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

SECTION_HEADING = "LÍNGUA INGLESA – 6º ANO"
END_MARKER = "4.2"  # start of "A área de Matemática..." intro

CODE_PATTERN = re.compile(r"\((EF0[6-9]LI\d{2})\)\s*(.*?)(?=\(EF0[6-9]LI\d{2}\)|\Z)", re.S)
GRADE_TO_LABEL = {"06": "6º ano", "07": "7º ano", "08": "8º ano", "09": "9º ano"}

EIXO_LABELS = {
    "EIXO ORALIDADE": "Oralidade",
    "EIXO LEITURA": "Leitura",
    "EIXO ESCRITA": "Escrita",
    "EIXO CONHECIMENTOS LINGUÍSTICOS": "Conhecimentos Linguísticos",
    "EIXO DIMENSÃO INTERCULTURAL": "Dimensão Intercultural",
}


def extract_pair(unit_page: pymupdf.Page, skill_page: pymupdf.Page, current_eixo: str | None) -> tuple[list[dict], str | None]:
    boundaries = table_boundaries(unit_page)
    boundaries[-1] = max(boundaries[-1], table_bottom(skill_page))
    # Each eixo opens with a long descriptive paragraph that sits above the
    # first detected row rule (confirmed by inspecting page 249's text
    # y-positions: the "UNIDADES TEMÁTICAS" column header sits at y≈129 and
    # "EIXO ORALIDADE — ..." starts at y≈163, both above the first rule at
    # y≈210). Extend the first row upward past the column header line so that
    # opening paragraph is captured instead of falling into no-man's-land.
    boundaries = [145.0, *boundaries]
    records: list[dict] = []

    for top, bottom in zip(boundaries, boundaries[1:]):
        unit_text = unit_page.get_textbox(pymupdf.Rect(62, top + 1, 291.5, bottom - 1))
        unit_upper = unit_text.upper().replace("\n", " ")
        matched_eixo = False
        for key, label in EIXO_LABELS.items():
            if key in unit_upper:
                current_eixo = label
                matched_eixo = True
                break
        # When the left column isn't the eixo heading itself, it's a categoria
        # sub-label the PDF prints alongside its objects (e.g. "Interação
        # discursiva"). Keep it — folding it into the object text preserves
        # this extra layer instead of silently dropping it.
        categoria = None if matched_eixo else clean_text(unit_text)
        object_text = clean_text(
            unit_page.get_textbox(pymupdf.Rect(292, top + 1, 552.4, bottom - 1)),
            preserve_lines=True,
        )
        if categoria and object_text:
            object_text = f"{categoria}: {object_text}"
        elif categoria:
            object_text = categoria
        skills_text = skill_page.get_textbox(pymupdf.Rect(40, top + 1, 536, bottom - 1))

        if not current_eixo:
            raise ValueError(f"No eixo established before page {unit_page.number + 1}, row {top}-{bottom}")

        for code, skill in CODE_PATTERN.findall(skills_text):
            grade_key = code[2:4]
            records.append(
                {
                    "codigo": code,
                    "etapa": "Ensino Fundamental",
                    "segmento": "Anos Finais",
                    "area": "Linguagens",
                    "componente": "Língua Inglesa",
                    "ano": GRADE_TO_LABEL[grade_key],
                    "anos_aplicaveis": [GRADE_TO_LABEL[grade_key]],
                    "unidade_tematica": current_eixo,
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

    return records, current_eixo


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
    current_eixo: str | None = None
    grade_pages = 0
    for unit_index in range(start, end, 2):
        skill_index = unit_index + 1
        if skill_index >= end:
            break
        # Each grade resets the eixo cycle every 4 pages (2 pairs); require a
        # fresh header rather than carrying a previous grade's eixo forward.
        if grade_pages % 4 == 0:
            current_eixo = None
        grade_pages += 2

        pair_records, current_eixo = extract_pair(document[unit_index], document[skill_index], current_eixo)
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
            "metodo_extracao": "PDF oficial; associação por linhas vetoriais das tabelas em páginas espelhadas, eixo detectado por cabeçalho de linha reiniciado a cada ciclo de 4 páginas (um por ano)",
            "data_extracao": imported_at,
            "escopo": "Ensino Fundamental — Anos Finais — Língua Inglesa — 6º ao 9º ano",
            "classificacao": "dado_oficial",
        },
        "habilidades": records,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(records), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
