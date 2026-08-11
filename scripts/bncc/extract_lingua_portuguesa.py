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
    "01": "1º ano", "02": "2º ano", "03": "3º ano", "04": "4º ano", "05": "5º ano",
    "06": "6º ano", "07": "7º ano", "08": "8º ano", "09": "9º ano",
    "12": "1º e 2º ano", "35": "3º ao 5º ano", "15": "1º ao 5º ano",
    "67": "6º e 7º ano", "89": "8º e 9º ano", "69": "6º ao 9º ano",
}
GRADE_CODE_TO_ANOS = {
    "01": ["1º ano"], "02": ["2º ano"], "03": ["3º ano"], "04": ["4º ano"], "05": ["5º ano"],
    "06": ["6º ano"], "07": ["7º ano"], "08": ["8º ano"], "09": ["9º ano"],
    "12": ["1º ano", "2º ano"], "35": ["3º ano", "4º ano", "5º ano"],
    "15": ["1º ano", "2º ano", "3º ano", "4º ano", "5º ano"],
    "67": ["6º ano", "7º ano"], "89": ["8º ano", "9º ano"],
    "69": ["6º ano", "7º ano", "8º ano", "9º ano"],
}

CAMPO_LABELS = {
    "CAMPO JORNALÍSTICO-MIDIÁTICO": "Campo Jornalístico-Midiático",
    "CAMPO DE ATUAÇÃO NA VIDA PÚBLICA": "Campo de Atuação na Vida Pública",
    "CAMPO DAS PRÁTICAS DE ESTUDO E PESQUISA": "Campo das Práticas de Estudo e Pesquisa",
    "CAMPO ARTÍSTICO-LITERÁRIO": "Campo Artístico-Literário",
    "TODOS OS CAMPOS DE ATUAÇÃO": "Todos os Campos de Atuação",
    # Anos Iniciais uses a shorter, distinct set of campo names — confirmed by
    # scanning every unit-column heading in that section before adding these
    # (never assumed to match the Anos Finais wording above).
    "CAMPO DA VIDA COTIDIANA": "Campo da Vida Cotidiana",
    "CAMPO DA VIDA PÚBLICA": "Campo da Vida Pública",
}


def looks_like_pratica_label(paragraph: str) -> bool:
    """A real prática label ("Leitura", "Oralidade", "Análise linguística/
    semiótica (Ortografização)") is short and doesn't open with a bullet
    dash. A campo's own multi-paragraph descriptive essay (e.g. Campo
    Artístico-Literário's intro, confirmed on page 157: four ~200-400 char
    bulleted paragraphs before the real "Leitura" label) is neither —
    distinguishing the two keeps that essay from being mistaken for the
    label itself.
    """
    flat = re.sub(r"\s+", " ", paragraph).strip()
    return bool(flat) and len(flat) <= 60 and not flat.startswith("-")


def match_campo(unit_upper: str) -> str | None:
    for key, label in CAMPO_LABELS.items():
        if key in unit_upper:
            return label
    return None


def unit_column_paragraphs(page: pymupdf.Page, top: float, bottom: float) -> list[str]:
    """Unit-column text for a row, split into visually separated paragraphs.

    A tall row can hold a campo's multi-line intro paragraph *and* the next
    prática de linguagem label stacked below it (confirmed on page 119: a
    campo intro paragraph's lines run ~12.8pt apart, then a ~26.5pt gap
    precedes "Leitura/escuta"). Treating the whole rect as one text blob
    made the campo match swallow that trailing label. Lines are grouped by
    vertical gap instead, so each paragraph can be checked independently.
    """
    lines: list[tuple[float, str]] = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            x0, y0 = line["bbox"][0], line["bbox"][1]
            if x0 < 62 or x0 >= 291.5 or not (top <= y0 <= bottom):
                continue
            text = "".join(span["text"] for span in line["spans"])
            # Controlled correction: the PDF's own span data for this prática
            # label has a stray space after the slash ("linguística/
            # semiótica") on every occurrence — confirmed directly in the
            # raw span text, not a line-wrap artifact of this extractor.
            # Restricted to this exact phrase, case-insensitively.
            text = re.sub(r"(lingu[íi]stica)/\s+(semi[óo]tica)", r"\1/\2", text, flags=re.IGNORECASE)
            if text.strip():
                lines.append((y0, text))
    lines.sort(key=lambda item: item[0])

    def join_lines(wrapped: list[str]) -> str:
        # A line ending in "/" (e.g. "Análise linguística/" wrapping to
        # "semiótica") is a mid-word break with no space in the source —
        # confirmed against the PDF, where clean_text's usual space-joined
        # rewrap inserted one that doesn't belong. Every other wrap still
        # joins on its own line, same as before.
        joined = ""
        for line in wrapped:
            line = line.rstrip()
            if not joined:
                joined = line
            elif joined.endswith("/"):
                joined += line.lstrip()
            else:
                joined += "\n" + line
        return joined

    paragraphs: list[str] = []
    current_lines: list[str] = []
    previous_y: float | None = None
    for y0, text in lines:
        if previous_y is not None and y0 - previous_y > 18:
            paragraphs.append(join_lines(current_lines))
            current_lines = []
        current_lines.append(text)
        previous_y = y0
    if current_lines:
        paragraphs.append(join_lines(current_lines))
    return paragraphs


def extract_pair(unit_page: pymupdf.Page, skill_page: pymupdf.Page, current_campo: str | None, segmento: str) -> tuple[list[dict], str | None]:
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
    # truncate trailing habilidades instead of extending the row. Extend by
    # appending a synthetic closing edge rather than overwriting boundaries[-1]
    # — that value is a real internal divider between the last two rows, and
    # replacing it merges their objeto_conhecimento/campo/prática text into one
    # (confirmed as a live bug this same pattern caused in the Anos Iniciais
    # Matemática extractor: EF04MA27 and EF04MA28 silently got identical,
    # concatenated objeto_conhecimento). Appending is strictly safer: it only
    # ever adds slack past the real table edge.
    page_edge = skill_page.rect.height - 40
    if page_edge > boundaries[-1]:
        boundaries.append(page_edge)
    boundaries = [145.0, *boundaries]
    records: list[dict] = []
    current_pratica: str | None = None

    for top, bottom in zip(boundaries, boundaries[1:]):
        # Checked paragraph by paragraph rather than as one blob: a row can
        # contain a campo's intro paragraph *and* the next prática label
        # stacked below it (see unit_column_paragraphs' docstring) — or,
        # rarer but confirmed on page 171 (EF06LP03-06), *two* campo
        # headers stacked in one merged row when the skills side's row
        # boundary is coarser than the true unit-side layout. This row's
        # own codes belong under the FIRST campo/prática pair encountered
        # (matches the pre-paragraph code's behavior there, which found it
        # via CAMPO_LABELS dict-iteration order rather than position — a
        # coincidence, not a rule, so it's reproduced deliberately here).
        # Any later campo match in the same row only updates the carried-
        # forward state for rows after this one.
        campo_at_row_start = current_campo
        pratica_at_row_start = current_pratica
        row_campo: str | None = None
        row_pratica: str | None = None
        running_pratica: str | None = None
        seen_campo_in_row = False

        for paragraph in unit_column_paragraphs(unit_page, top + 1, bottom - 1):
            paragraph_upper = paragraph.upper().replace("\n", " ").strip()
            campo = match_campo(paragraph_upper)
            if campo:
                if seen_campo_in_row:
                    if row_pratica is None:
                        row_pratica = running_pratica
                else:
                    row_campo = campo
                    seen_campo_in_row = True
                current_campo = campo
                current_pratica = None
                running_pratica = None
            elif paragraph_upper:
                # Two non-campo paragraphs can appear back to back — a
                # prática label plus its own footnote annotation, e.g.
                # "Oralidade" then "*Considerar todas as habilidades..."
                # (confirmed on page 143, gap 18.4pt — just over the
                # paragraph-break threshold). Both belong together, the
                # same as the pre-paragraph blob-based code would have
                # space-joined them; only a real campo match should ever
                # discard what came before. But a campo's own descriptive
                # essay (confirmed on page 157: four bulleted paragraphs
                # ahead of Campo Artístico-Literário's real "Leitura" label)
                # is prose, not a label — and prose with no label
                # established yet in this row is dropped rather than
                # mistaken for one.
                cleaned = clean_text(paragraph)
                if looks_like_pratica_label(paragraph):
                    running_pratica = cleaned
                elif running_pratica is not None:
                    running_pratica = f"{running_pratica} {cleaned}"
                if running_pratica is not None:
                    current_pratica = running_pratica

        if row_campo is None:
            row_campo = campo_at_row_start
        if row_pratica is None:
            row_pratica = running_pratica if running_pratica is not None else pratica_at_row_start

        object_text = clean_text(
            column_text(unit_page, 292, 552.4, top + 1, bottom - 1),
            preserve_lines=True,
        )
        if row_pratica and object_text:
            object_text = f"{row_pratica}: {object_text}"
        elif row_pratica:
            object_text = row_pratica

        skills_text = skill_page.get_textbox(pymupdf.Rect(40, top + 1, 536, bottom - 1))
        matches = CODE_PATTERN.findall(skills_text)

        # Only a row that actually carries a habilidade needs a campo already
        # established — a purely column-header row (e.g. "PRÁTICAS DE
        # LINGUAGEM / OBJETOS DE CONHECIMENTO" landing in the synthetic
        # lead-in row when a subsection's campo heading sits lower than usual)
        # has no code to attach one to and shouldn't be treated as an error.
        if matches and not row_campo:
            raise ValueError(f"No campo de atuação established before page {unit_page.number + 1}, row {top}-{bottom}")

        for code, raw_text in matches:
            grade_code = code[2:4]
            if grade_code not in GRADE_CODE_TO_LABEL:
                raise ValueError(f"Unknown grade code {grade_code!r} in {code} on page {skill_page.number + 1}")

            records.append(
                {
                    "codigo": code,
                    "etapa": "Ensino Fundamental",
                    "segmento": segmento,
                    "area": "Linguagens",
                    "componente": "Língua Portuguesa",
                    "ano": GRADE_CODE_TO_LABEL[grade_code],
                    "anos_aplicaveis": GRADE_CODE_TO_ANOS[grade_code],
                    "campo_atuacao": row_campo,
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
    parser.add_argument("--section-headings", default=None, help="Comma-separated subsection headings; defaults to the Anos Finais set")
    parser.add_argument("--end-marker", default=END_MARKER)
    parser.add_argument("--segmento", default="Anos Finais")
    parser.add_argument("--escopo-nota", default="6º ao 9º ano")
    args = parser.parse_args()

    if args.download:
        download_pdf(args.pdf)
    if not args.pdf.exists():
        raise FileNotFoundError(f"Official PDF not found: {args.pdf}")

    section_headings = args.section_headings.split("|") if args.section_headings else SECTION_HEADINGS

    document = pymupdf.open(args.pdf)

    section_starts = [find_heading_page(document, heading) for heading in section_headings]
    end_page = find_heading_page(document, args.end_marker, start=section_starts[-1])
    section_bounds = list(zip(section_starts, section_starts[1:] + [end_page]))

    records: list[dict] = []
    for start, end in section_bounds:
        current_campo: str | None = None
        for unit_index in range(start, end, 2):
            skill_index = unit_index + 1
            if skill_index >= end:
                break
            pair_records, current_campo = extract_pair(document[unit_index], document[skill_index], current_campo, args.segmento)
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
            "escopo": f"Ensino Fundamental — {args.segmento} — Língua Portuguesa — {args.escopo_nota}",
            "classificacao": "dado_oficial",
        },
        "habilidades": records,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(records), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
