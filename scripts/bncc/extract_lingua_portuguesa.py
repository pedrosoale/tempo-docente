#!/usr/bin/env python3
"""Extract BNCC Língua Portuguesa skills for Ensino Fundamental — Anos Finais (6º-9º)
from the official MEC PDF.

Unlike Matemática, this component is organized in three levels — campo de atuação,
then prática de linguagem (Leitura, Oralidade, Escrita, Análise Linguística/Semiótica),
then objetos de conhecimento — but the underlying table is the same mirrored vector-row
structure as every other component (confirmed by inspecting the PDF's own drawing
commands, not assumed). Skill codes may denote one grade (EF06LP01), a pair of adjacent
grades (EF67LP01), or the full 6th-9th range (EF69LP01) — the grade digits are derived
from the code itself and validated against the set actually observed in this section.
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
    column_text,
    download_pdf,
    find_heading_page,
    table_boundaries,
)

SECTION_HEADINGS = [
    "LÍNGUA PORTUGUESA – 6º AO 9º ANO",
    "LÍNGUA PORTUGUESA – 6º E 7º ANOS",
    "LÍNGUA PORTUGUESA – 8º E 9º ANOS",
]
END_MARKER = "4.1.2"  # start of the next component (Arte); bounds the last section

CODE_PATTERN = re.compile(r"\((EF\d{2}LP\d{2})\)\s*(.*?)(?=\(EF\d{2}LP\d{2}\)|\Z)", re.S)

GRADE_CODE_TO_LABEL = {
    "06": "6º ano", "07": "7º ano", "08": "8º ano", "09": "9º ano",
    "67": "6º e 7º ano", "89": "8º e 9º ano", "69": "6º ao 9º ano",
}
GRADE_CODE_TO_ANOS = {
    "06": ["6º ano"], "07": ["7º ano"], "08": ["8º ano"], "09": ["9º ano"],
    "67": ["6º ano", "7º ano"], "89": ["8º ano", "9º ano"],
    "69": ["6º ano", "7º ano", "8º ano", "9º ano"],
}

CAMPO_LABELS = {
    "CAMPO JORNALÍSTICO-MIDIÁTICO": "Campo Jornalístico-Midiático",
    "CAMPO DE ATUAÇÃO NA VIDA PÚBLICA": "Campo de Atuação na Vida Pública",
    "CAMPO DAS PRÁTICAS DE ESTUDO E PESQUISA": "Campo das Práticas de Estudo e Pesquisa",
    "CAMPO ARTÍSTICO-LITERÁRIO": "Campo Artístico-Literário",
    "TODOS OS CAMPOS DE ATUAÇÃO": "Todos os Campos de Atuação",
}


def match_campo(unit_upper: str) -> str | None:
    for key, label in CAMPO_LABELS.items():
        if key in unit_upper:
            return label
    return None


def extract_pair(unit_page: pymupdf.Page, skill_page: pymupdf.Page, current_campo: str | None) -> tuple[list[dict], str | None]:
    # A campo's opening paragraph ("CAMPO X — Trata-se de...") sits above the
    # first detected row rule (confirmed on page 141: column headers at
    # y≈130, campo heading at y≈164, first rule at y≈358). Extend the first
    # row upward past the column headers so that heading is captured as the
    # campo instead of falling into no-man's-land before any rule exists.
    # Some campos (e.g. Artístico-Literário) devote nearly the whole page to
    # that opening paragraph, leaving only a single real row rule below it —
    # table_boundaries() then has only one boundary to report, which is fine
    # once combined with the synthetic 145.0 lead-in below.
    boundaries = table_boundaries(unit_page, min_count=1)
    # table_bottom() looks for a single wide continuous rule and is unreliable
    # here: on some pages it returns a value *smaller* than the already-detected
    # last boundary (confirmed on page 172, where it reported 392 while real
    # habilidade text — EF06LP04-06 — runs to y≈670), which would silently
    # truncate trailing habilidades instead of extending the row. Always
    # extend to the page's usable content height instead; a little slack past
    # the real table edge only risks harmless trailing whitespace, never a
    # dropped code.
    boundaries[-1] = max(boundaries[-1], skill_page.rect.height - 40)
    boundaries = [145.0, *boundaries]
    records: list[dict] = []
    current_pratica: str | None = None

    for top, bottom in zip(boundaries, boundaries[1:]):
        unit_text = unit_page.get_textbox(pymupdf.Rect(62, top + 1, 291.5, bottom - 1))
        unit_upper = unit_text.upper().replace("\n", " ").strip()
        campo = match_campo(unit_upper)
        if campo:
            current_campo = campo
            current_pratica = None  # a fresh campo resets the práticas cycle
        elif unit_upper:
            # Not a campo header: it's the prática de linguagem label for this
            # row (Leitura, Oralidade, Escrita, Análise Linguística/Semiótica…).
            current_pratica = clean_text(unit_text)

        object_text = clean_text(
            column_text(unit_page, 292, 552.4, top + 1, bottom - 1),
            preserve_lines=True,
        )
        if current_pratica and object_text:
            object_text = f"{current_pratica}: {object_text}"
        elif current_pratica:
            object_text = current_pratica

        skills_text = skill_page.get_textbox(pymupdf.Rect(40, top + 1, 536, bottom - 1))

        if not current_campo:
            raise ValueError(f"No campo de atuação established before page {unit_page.number + 1}, row {top}-{bottom}")

        for code, raw_text in CODE_PATTERN.findall(skills_text):
            grade_code = code[2:4]
            if grade_code not in GRADE_CODE_TO_LABEL:
                raise ValueError(f"Unknown grade code {grade_code!r} in {code} on page {skill_page.number + 1}")

            records.append(
                {
                    "codigo": code,
                    "etapa": "Ensino Fundamental",
                    "segmento": "Anos Finais",
                    "area": "Linguagens",
                    "componente": "Língua Portuguesa",
                    "ano": GRADE_CODE_TO_LABEL[grade_code],
                    "anos_aplicaveis": GRADE_CODE_TO_ANOS[grade_code],
                    "campo_atuacao": current_campo,
                    "objeto_conhecimento": object_text if object_text else None,
                    "habilidade": clean_text(raw_text),
                    "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
                    "fonte_url": SOURCE_URL,
                    "documento_url": PDF_URL,
                    "versao_fonte": SOURCE_VERSION,
                    "pagina_fonte": skill_page.number,
                    "classificacao": "dado_oficial",
                }
            )

    return records, current_campo


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

    section_starts = [find_heading_page(document, heading) for heading in SECTION_HEADINGS]
    end_page = find_heading_page(document, END_MARKER, start=section_starts[-1])
    section_bounds = list(zip(section_starts, section_starts[1:] + [end_page]))

    records: list[dict] = []
    for start, end in section_bounds:
        current_campo: str | None = None
        for unit_index in range(start, end, 2):
            skill_index = unit_index + 1
            if skill_index >= end:
                break
            pair_records, current_campo = extract_pair(document[unit_index], document[skill_index], current_campo)
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
            "metodo_extracao": "PDF oficial; associação por linhas vetoriais das tabelas em páginas espelhadas (mesma técnica de Matemática); campo de atuação e prática de linguagem detectados por cabeçalho de linha com herança",
            "data_extracao": imported_at,
            "escopo": "Ensino Fundamental — Anos Finais — Língua Portuguesa — 6º ao 9º ano",
            "classificacao": "dado_oficial",
        },
        "habilidades": records,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(records), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
