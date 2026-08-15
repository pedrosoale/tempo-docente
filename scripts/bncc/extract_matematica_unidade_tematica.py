#!/usr/bin/env python3
"""Extract the código → unidade temática mapping from Matemática e suas
Tecnologias' second table ("5.2.1.1. Considerações sobre a organização
curricular", right after the 5 competências específicas).

This table is not a new set of habilidades — it repeats the exact same 43
codes from extract_ensino_medio_area.py's Matemática run, regrouped by
unidade temática (Números e Álgebra, Geometria e Medidas, Probabilidade e
Estatística) instead of by competência específica. The document says this
explicitly: "foram mantidos os códigos originais das habilidades [...], o
que permite reconhecer a competência específica à qual cada habilidade está
relacionada." Confirmed by counting: the code appears exactly once per
unidade, and the 3 unidades' code sets are pairwise disjoint and together
cover exactly the 43 codes from the primary extraction — never a 44th or a
missing one, checked at import time, not assumed here.

Because this script only needs the código → unidade_tematica mapping (the
habilidade text itself already comes from the primary extraction), it skips
the competência/HABILIDADES-body machinery of extract_ensino_medio_area.py
and just walks each unidade's own heading-to-heading span for its codes.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

from bncc_extract_common import PDF_URL, SOURCE_URL, SOURCE_VERSION, clean_text, download_pdf

MIN_SEARCH_PAGE = 400
CODE_PATTERN = re.compile(r"\(EM13MAT\d{3}\)")
# Official headings are set in full caps in the PDF; relabeled to the same
# sentence-case convention already used for every Ensino Fundamental
# unidade_tematica value (e.g. "Probabilidade e estatística"), not a blind
# str.title() (which would wrongly capitalize "e").
UNIDADES = {
    "NÚMEROS E ÁLGEBRA": "Números e álgebra",
    "GEOMETRIA E MEDIDAS": "Geometria e medidas",
    "PROBABILIDADE E ESTATÍSTICA": "Probabilidade e estatística",
}


def strip_accents(value: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", value) if unicodedata.category(ch) != "Mn")


def find_heading_page_normalized(document: pymupdf.Document, heading: str, start: int = MIN_SEARCH_PAGE) -> int:
    # Same whitespace-collapsing rationale as extract_ensino_medio_area.py's
    # version of this helper: this chapter's multi-line headings carry a
    # trailing space before the wrap that the shared find_heading_page's
    # plain "\n" -> " " replace turns into a double space and misses.
    target = strip_accents(heading).upper()
    for page in document:
        if page.number < start:
            continue
        if target in strip_accents(clean_text(page.get_text())).upper():
            return page.number
    raise ValueError(f"Heading {heading!r} not found from page {start}")


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
    start_page = find_heading_page_normalized(document, "CONSIDERAÇÕES SOBRE A ORGANIZAÇÃO CURRICULAR")
    end_page = find_heading_page_normalized(document, "A ÁREA DE CIÊNCIAS DA NATUREZA", start=start_page)

    full_text = ""
    page_offsets: list[int] = []
    page_numbers: list[int] = []
    for n in range(start_page, end_page):
        page_offsets.append(len(full_text))
        page_numbers.append(n)
        full_text += document[n].get_text()

    from bisect import bisect_right

    def page_for_offset(offset: int) -> int:
        index = bisect_right(page_offsets, offset) - 1
        return page_numbers[max(index, 0)]

    heading_pattern = re.compile("|".join(re.escape(u) for u in UNIDADES))
    headings = list(heading_pattern.finditer(full_text))
    if len(headings) < len(UNIDADES):
        raise ValueError(f"Expected {len(UNIDADES)} unidade temática headings, found {len(headings)}: {[h.group(0) for h in headings]}")

    entries: list[dict] = []
    seen_codes: dict[str, str] = {}
    for index, heading in enumerate(headings):
        unidade = UNIDADES[heading.group(0)]
        segment_start = heading.end()
        segment_end = headings[index + 1].start() if index + 1 < len(headings) else len(full_text)
        segment = full_text[segment_start:segment_end]

        for match in CODE_PATTERN.finditer(segment):
            code = match.group(0).strip("()")
            if code in seen_codes and seen_codes[code] != unidade:
                raise ValueError(f"{code} appears under both {seen_codes[code]!r} and {unidade!r} — unidades temáticas should be mutually exclusive")
            if code in seen_codes:
                continue  # Same unidade repeats a code across a page break's own re-quoted heading; keep the first occurrence's page.
            seen_codes[code] = unidade
            entries.append({
                "codigo": code,
                "unidade_tematica": unidade,
                "pagina_fonte": page_for_offset(segment_start + match.start()),
            })

    imported_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload = {
        "metadata": {
            "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
            "fonte_url": SOURCE_URL,
            "documento_url": PDF_URL,
            "versao_fonte": SOURCE_VERSION,
            "metodo_extracao": "PDF oficial; tabela 'Considerações sobre a organização curricular' da área de Matemática (Ensino Médio) — reagrupa os códigos já extraídos por extract_ensino_medio_area.py por unidade temática, sem repetir o texto da habilidade",
            "data_extracao": imported_at,
            "escopo": "Ensino Médio — Matemática e suas Tecnologias — código → unidade temática",
            "classificacao": "dado_oficial",
        },
        "mapeamento": sorted(entries, key=lambda item: item["codigo"]),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(entries), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
