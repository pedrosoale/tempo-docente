#!/usr/bin/env python3
"""Extract BNCC skills for Ensino Médio — Formação Geral Básica, for the 4
áreas do conhecimento that share a common, table-free layout: Linguagens e
suas Tecnologias, Matemática e suas Tecnologias, Ciências da Natureza e suas
Tecnologias, Ciências Humanas e Sociais Aplicadas.

Confirmed by reading the full text of every área before writing this script:
none of the 4 uses a real vector table (get_drawings() only finds decorative
header/footer rules, unlike the Ensino Fundamental component tables). Each
área starts with a numbered list giving the concise text of its competências
específicas, then a detailed section that repeats each "COMPETÊNCIA
ESPECÍFICA N" heading followed by a "HABILIDADES" block listing
"(CÓDIGO) texto." until the next competência or the end of the área.

Língua Portuguesa (within Linguagens) is NOT one of these 4 — it is organized
by campo de atuação social with a separate competências-específicas
cross-reference column instead, and has its own dedicated script
(extract_lingua_portuguesa_medio.py). Matemática has one área-specific
wrinkle: after its 5 competências específicas, the document repeats the same
43 habilidades a second time, regrouped by unidade temática instead of
competência — the caller must pass --end-marker "CONSIDERAÇÕES SOBRE A
ORGANIZAÇÃO CURRICULAR" so this script stops before that second table
(confirmed by counting: without the boundary, naive extraction over the page
range finds 86 code occurrences for Matemática, exactly double the real 43).
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from bisect import bisect_right
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

from bncc_extract_common import (
    PDF_URL,
    SOURCE_URL,
    SOURCE_VERSION,
    clean_text,
    download_pdf,
)

# Ensino Fundamental runs through roughly page 460 of the consolidated PDF;
# never search the table of contents or the EF chapters for Ensino Médio
# headings, which are short enough that they could otherwise coincidentally
# match front-matter text.
MIN_SEARCH_PAGE = 400
MAX_LOOKAHEAD_PAGES = 5

# The concise competências list numbers its items as "N.\tTexto" for
# Linguagens (the same tab already used for Competências Gerais) but as
# "N. Texto" (plain space) for Matemática, Ciências da Natureza and Ciências
# Humanas — confirmed by inspecting the raw extracted bytes of each área's
# list page rather than assumed from one área's format. \s+ covers both.
COMPETENCIA_ITEM_PATTERN = re.compile(r"(?m)^(\d{1,2})\.\s+(.+?)(?=\n\d{1,2}\.\s|\Z)", re.S)

# Anchored to a whole, all-caps line so this only matches the real section
# heading, never the lowercase inline cross-references that show up in the
# explanatory prose (e.g. "...contribuindo para a competência específica 1").
COMPETENCIA_HEADING_PATTERN = re.compile(r"(?m)^COMPET[ÊE]NCIA ESPEC[ÍI]FICA (\d+)\s*$")
HABILIDADES_HEADING_PATTERN = re.compile(r"(?m)^HABILIDADES\s*$")

# Documented, área-specific typographic correction: a ligature glyph
# (U+FB01, "ﬁ") the PyMuPDF text layer renders as its own token followed by
# a spurious space, breaking words apart on the Ciências Humanas concise
# competências list page. Same controlled-correction pattern as the Ensino
# Fundamental fixes (ax², π, hyphenation): restricted to the exact strings
# confirmed against the raw PDF, never a broad ligature-wide substitution.
# All 3 confirmed occurrences of the ligature glyph in the whole Ensino
# Médio chapter fall on this one page (found by scanning every page for the
# raw glyph, not assumed from the first hit — the first pass here only
# caught "cientíﬁ cos" and missed the other two words on the same page).
CONTROLLED_TYPOGRAPHY_CORRECTIONS: dict[str, tuple[tuple[str, str], ...]] = {
    "ciencias-humanas": (
        ("cientíﬁ cos", "científicos"),
        ("cientíﬁ ca", "científica"),
        ("Identiﬁ car", "Identificar"),
    ),
}


def strip_accents(value: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", value) if unicodedata.category(ch) != "Mn")


def find_heading_page_normalized(document: pymupdf.Document, heading: str, start: int = MIN_SEARCH_PAGE) -> int:
    """Same contract as bncc_extract_common.find_heading_page, but collapses
    whitespace via clean_text() before matching.

    The Ensino Médio chapter's multi-line headings carry a trailing space
    before the line wrap (e.g. "LINGUAGENS E SUAS \\nTECNOLOGIAS"), which
    the shared helper's plain "\\n" -> " " replace turns into a double space
    and then silently fails to match — confirmed against the raw PDF text
    before relying on this, not assumed.
    """
    target = strip_accents(heading).upper()
    for page in document:
        if page.number < start:
            continue
        text = strip_accents(clean_text(page.get_text())).upper()
        if target in text:
            return page.number
    raise ValueError(f"Heading {heading!r} not found from page {start}")


def restore_official_typography(text: str, area_slug: str) -> str:
    for flattened, official in CONTROLLED_TYPOGRAPHY_CORRECTIONS.get(area_slug, ()):
        text = text.replace(flattened, official)
    return text


# Every page in this chapter repeats a 3-line running header (page number,
# then a 2-line title — either "BASE NACIONAL / COMUM CURRICULAR" or the
# área name / "ENSINO MÉDIO", depending on left/right page) before its real
# content. Confirmed by reading page.get_text() for every page in the
# Linguagens range: the header always starts with the bare page number as
# its own first line, so that is what triggers the strip — not a fixed
# offset assumed from a single page. Without this, the header of the page a
# competência's last habilidade spills onto gets swept into that
# habilidade's own text by the "up to the next code" regex lookahead
# (confirmed: EM13LGG105 came out ending in "... 492 BASE NACIONAL COMUM
# CURRICULAR" before this fix).
def strip_running_header(raw_text: str) -> str:
    lines = raw_text.split("\n")
    if lines and re.match(r"^\d{1,3}$", lines[0].strip()):
        return "\n".join(lines[3:])
    return raw_text


# Defensive net for páginas where the header doesn't start the page's own
# text (confirmed this happens at least once, on a Ciências da Natureza
# page where PyMuPDF's block-reading order puts "HABILIDADES" ahead of the
# running header for that one page) — strip_running_header would miss that
# case, so every accepted competência/habilidade text is checked for this
# telltale fragment of the document's own title before being accepted,
# instead of trusting the position-based strip silently.
def assert_no_running_header_leak(text: str, context: str) -> None:
    upper = strip_accents(text).upper()
    if "BASE NACIONAL" in upper and "COMUM CURRICULAR" in upper:
        raise ValueError(f"Running-header text leaked into {context}: {text!r}")


def extract_competencias(document: pymupdf.Document, list_page: int, num_competencias: int, area_slug: str) -> list[dict]:
    found: dict[int, dict] = {}
    for offset in range(MAX_LOOKAHEAD_PAGES):
        page = document[list_page + offset]
        for number, body in COMPETENCIA_ITEM_PATTERN.findall(strip_running_header(page.get_text())):
            n = int(number)
            if n in found or n < 1 or n > num_competencias:
                continue
            texto = restore_official_typography(clean_text(body), area_slug)
            assert_no_running_header_leak(texto, f"competência específica {n}")
            found[n] = {"numero": n, "texto": texto, "pagina_fonte": page.number}
        if len(found) >= num_competencias:
            break

    missing = [n for n in range(1, num_competencias + 1) if n not in found]
    if missing:
        raise ValueError(f"Missing competências específicas: {missing} (found {sorted(found)})")
    return [found[n] for n in range(1, num_competencias + 1)]


def extract_habilidades(
    document: pymupdf.Document,
    start_page: int,
    end_page: int,
    code_prefix: str,
    area: str,
    componente: str,
) -> list[dict]:
    code_pattern = re.compile(rf"\((EM13{code_prefix}\d{{3}})\)\s*(.+?)(?=\(EM13{code_prefix}\d{{3}}\)|\Z)", re.S)

    full_text = ""
    page_offsets: list[int] = []
    page_numbers: list[int] = []
    for n in range(start_page, end_page):
        page_offsets.append(len(full_text))
        page_numbers.append(n)
        full_text += strip_running_header(document[n].get_text())

    def page_for_offset(offset: int) -> int:
        index = bisect_right(page_offsets, offset) - 1
        return page_numbers[max(index, 0)]

    headings = list(COMPETENCIA_HEADING_PATTERN.finditer(full_text))
    if not headings:
        raise ValueError(f"No 'COMPETÊNCIA ESPECÍFICA N' headings found between pages {start_page}-{end_page}")

    records: list[dict] = []
    for index, heading in enumerate(headings):
        competencia_numero = int(heading.group(1))
        segment_start = heading.end()
        segment_end = headings[index + 1].start() if index + 1 < len(headings) else len(full_text)
        segment = full_text[segment_start:segment_end]

        habilidades_marker = HABILIDADES_HEADING_PATTERN.search(segment)
        if not habilidades_marker:
            raise ValueError(f"No 'HABILIDADES' block found for competência específica {competencia_numero}")
        habilidades_text = segment[habilidades_marker.end():]

        # A long habilidades list can spill onto a page that reprints the
        # "HABILIDADES" label as a continuation marker instead of the usual
        # running header (confirmed on a Ciências da Natureza page: it has
        # no page-number header at all, just "HABILIDADES" as the page's own
        # first line) — that reprint sits between two complete codes, never
        # mid-habilidade, but left in place it glues onto whichever code's
        # lookahead reaches it (confirmed: EM13CNT307 came out ending in
        # "... cotidiano. HABILIDADES" before this fix). Sanitize a copy for
        # the code/body regex only; page attribution below still searches
        # the original habilidades_text, since removing the marker would
        # shift offsets out of sync with page_offsets.
        sanitized_habilidades_text = HABILIDADES_HEADING_PATTERN.sub(" ", habilidades_text)

        for code, body in code_pattern.findall(sanitized_habilidades_text):
            offset = segment_start + habilidades_marker.end() + habilidades_text.index(f"({code})")
            texto = clean_text(body)
            assert_no_running_header_leak(texto, code)
            records.append(
                {
                    "codigo": code,
                    "etapa": "Ensino Médio",
                    "area": area,
                    "componente": componente,
                    "competencia_especifica": competencia_numero,
                    "habilidade": texto,
                    "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
                    "fonte_url": SOURCE_URL,
                    "documento_url": PDF_URL,
                    "versao_fonte": SOURCE_VERSION,
                    "pagina_fonte": page_for_offset(offset),
                    "classificacao": "dado_oficial",
                }
            )

    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--area-slug", required=True, help='e.g. "linguagens"')
    parser.add_argument("--area", required=True, help='e.g. "Linguagens e suas Tecnologias"')
    parser.add_argument("--componente", required=True, help="Usually equal to --area; distinct only for Língua Portuguesa's own script")
    parser.add_argument("--code-prefix", required=True, help='e.g. "LGG"')
    parser.add_argument("--num-competencias", type=int, required=True)
    parser.add_argument("--concise-heading", required=True, help='e.g. "COMPETÊNCIAS ESPECÍFICAS DE LINGUAGENS E SUAS TECNOLOGIAS PARA O ENSINO MÉDIO"')
    parser.add_argument("--end-marker", required=True, help="Heading text that starts right after this área's detailed habilidades section ends")
    args = parser.parse_args()

    if args.download:
        download_pdf(args.pdf)
    if not args.pdf.exists():
        raise FileNotFoundError(f"Official PDF not found: {args.pdf}")

    document = pymupdf.open(args.pdf)
    concise_page = find_heading_page_normalized(document, args.concise_heading)
    competencias = extract_competencias(document, concise_page, args.num_competencias, args.area_slug)

    detailed_start = find_heading_page_normalized(document, "COMPETÊNCIA ESPECÍFICA 1", start=concise_page)
    detailed_end = find_heading_page_normalized(document, args.end_marker, start=detailed_start)
    habilidades = extract_habilidades(document, detailed_start, detailed_end, args.code_prefix, args.area, args.componente)
    habilidades = [dict(record, habilidade=restore_official_typography(record["habilidade"], args.area_slug)) for record in habilidades]

    seen = set()
    for record in habilidades:
        if record["codigo"] in seen:
            raise ValueError(f"Duplicate code extracted: {record['codigo']}")
        seen.add(record["codigo"])
    if not habilidades:
        raise ValueError("No records extracted — check section boundaries")

    imported_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload = {
        "metadata": {
            "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
            "fonte_url": SOURCE_URL,
            "documento_url": PDF_URL,
            "versao_fonte": SOURCE_VERSION,
            "metodo_extracao": "PDF oficial; documento consolidado final (EI+EF+EM) — capítulo do Ensino Médio, seção da área localizada pelo próprio texto do documento; sem tabela vetorial (prosa corrida com marcadores 'COMPETÊNCIA ESPECÍFICA N' e 'HABILIDADES')",
            "data_extracao": imported_at,
            "escopo": f"Ensino Médio — Formação Geral Básica — {args.area}",
            "classificacao": "dado_oficial",
        },
        "competencias": competencias,
        "habilidades": habilidades,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total_competencias": len(competencias), "total_habilidades": len(habilidades), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
