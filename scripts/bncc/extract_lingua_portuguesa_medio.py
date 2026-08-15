#!/usr/bin/env python3
"""Extract BNCC habilidades for Língua Portuguesa — Ensino Médio (a
component with its own weight inside the Linguagens e suas Tecnologias
área, not one of the 4 áreas extract_ensino_medio_area.py handles).

Structurally different from the 4 áreas, confirmed by reading the full
chapter (pages 506-527) before writing this script — the same lesson
Língua Portuguesa already taught this project once for Ensino Fundamental
(see data/bncc/README.md's "Campo/prática por parágrafo" section), and it
repeats here in a different shape:

- Organized by **campo de atuação social** (6 of them: Todos os Campos de
  Atuação Social, Campo da Vida Pessoal, Campo de Atuação na Vida Pública,
  Campo das Práticas de Estudo e Pesquisa, Campo Jornalístico-Midiático,
  Campo Artístico-Literário), never by competência específica directly.
- Língua Portuguesa has no competências específicas of its own — each
  habilidade instead carries a **cross-reference to 1+ of Linguagens e suas
  Tecnologias' 7 competências** (a document note confirms this: "ainda que
  uma mesma habilidade possa estar a serviço de mais de uma competência
  específica da área de Linguagens [...], indica(m)-se aquela(s) com a(s)
  qual(is) cada habilidade tem maior afinidade"), printed as a small table
  column: one or more comma-separated digits on their own line right after
  each habilidade's paragraph.
- Every table page repeats a 6-line column-header block (campo name,
  "PRÁTICAS", the practice description, "Habilidades", "Competências",
  "específicas") in addition to the standard 3-line running header — and,
  confirmed by reading every page in range, a campo's own narrative
  introduction and "Parâmetros para a organização/progressão curricular"
  bullet list can sit between one campo's last habilidade and the next
  campo's real table (e.g. between EM13LP18 and EM13LP19). A "capture up to
  the next code" approach (used for the 4 simple áreas) would swallow that
  whole narrative into the preceding habilidade's text.

Because of that, this extractor does not try to strip headers or delimit
campo sections at all. It matches each habilidade as one atomic unit —
code, body, and its own trailing competências-específicas digit line — so
the match itself never runs past a single table row, regardless of what
header or narrative noise sits around it. Campo de atuação is assigned
separately, by carrying forward the nearest preceding bare campo heading
line (confirmed reliable: read every such heading in the chapter and
verified the resulting 18/4/5/8/10/9 split against every page by hand
before trusting it).
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

from bncc_extract_common import PDF_URL, SOURCE_URL, SOURCE_VERSION, clean_text, download_pdf

MIN_SEARCH_PAGE = 400

# Official headings are set in full caps in the PDF; relabeled here to the
# same "Campo (de/da/das/na) X" sentence-style casing already established
# for Ensino Fundamental's campo_atuacao values (see LP_KNOWN_CAMPOS in
# import.mjs) — an explicit mapping, not a blind str.title() (which would
# wrongly capitalize "de"/"da"/"na"). "Todos os Campos de Atuação Social"
# is a distinct label from EF's shorter "Todos os Campos de Atuação": the
# EM document's own heading includes "Social", so it is kept rather than
# forced to match the EF string.
CAMPOS = {
    "TODOS OS CAMPOS DE ATUAÇÃO SOCIAL": "Todos os Campos de Atuação Social",
    "CAMPO DA VIDA PESSOAL": "Campo da Vida Pessoal",
    "CAMPO DE ATUAÇÃO NA VIDA PÚBLICA": "Campo de Atuação na Vida Pública",
    "CAMPO DAS PRÁTICAS DE ESTUDO E PESQUISA": "Campo das Práticas de Estudo e Pesquisa",
    "CAMPO JORNALÍSTICO-MIDIÁTICO": "Campo Jornalístico-Midiático",
    "CAMPO ARTÍSTICO-LITERÁRIO": "Campo Artístico-Literário",
}
CAMPO_HEADING_PATTERN = re.compile("(?m)^(" + "|".join(re.escape(c) for c in CAMPOS) + r")\s*$")

# Atomic match: a habilidade is only ever accepted together with its own
# trailing competências-específicas digit line, so the lazy body can never
# run past a single table row into whatever text follows it.
CODE_PATTERN = re.compile(r"\((EM13LP\d{2})\)\s*(.+?)\n(\d{1,2}(?:,\s*\d{1,2})*)\s*\n", re.S)


def strip_accents(value: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", value) if unicodedata.category(ch) != "Mn")


def find_heading_page_normalized(document: pymupdf.Document, heading: str, start: int = MIN_SEARCH_PAGE) -> int:
    target = strip_accents(heading).upper()
    for page in document:
        if page.number < start:
            continue
        if target in strip_accents(clean_text(page.get_text())).upper():
            return page.number
    raise ValueError(f"Heading {heading!r} not found from page {start}")


def strip_running_header(raw_text: str) -> str:
    lines = raw_text.split("\n")
    if lines and re.match(r"^\d{1,3}$", lines[0].strip()):
        return "\n".join(lines[3:])
    return raw_text


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
    start_page = find_heading_page_normalized(document, "CAMPOS DE ATUAÇÃO SOCIAL, COMPETÊNCIAS ESPECÍFICAS E HABILIDADES")
    end_page = find_heading_page_normalized(document, "A ÁREA DE MATEMÁTICA", start=start_page)

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

    campo_matches = [(match.start(), match.group(1)) for match in CAMPO_HEADING_PATTERN.finditer(full_text)]
    if not campo_matches:
        raise ValueError("No campo de atuação social headings found")
    campo_positions = [position for position, _ in campo_matches]
    campo_names = [name for _, name in campo_matches]

    def campo_for_offset(offset: int) -> str:
        index = bisect_right(campo_positions, offset) - 1
        if index < 0:
            raise ValueError(f"No campo heading precedes text offset {offset}")
        return CAMPOS[campo_names[index]]

    records: list[dict] = []
    seen: set[str] = set()
    for match in CODE_PATTERN.finditer(full_text):
        code = match.group(1)
        if code in seen:
            raise ValueError(f"Duplicate code extracted: {code}")
        seen.add(code)

        competencias = sorted({int(value.strip()) for value in match.group(3).split(",")})
        if any(numero < 1 or numero > 7 for numero in competencias):
            raise ValueError(f"{code}: competência específica fora do intervalo 1-7: {competencias}")

        records.append({
            "codigo": code,
            "etapa": "Ensino Médio",
            "area": "Linguagens e suas Tecnologias",
            "componente": "Língua Portuguesa",
            "campo_atuacao": campo_for_offset(match.start()),
            "competencias_especificas": competencias,
            "habilidade": clean_text(match.group(2)),
            "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
            "fonte_url": SOURCE_URL,
            "documento_url": PDF_URL,
            "versao_fonte": SOURCE_VERSION,
            "pagina_fonte": page_for_offset(match.start()),
            "classificacao": "dado_oficial",
        })

    expected_codes = {f"EM13LP{n:02d}" for n in range(1, 55)}
    missing = expected_codes - seen
    if missing:
        raise ValueError(f"Missing expected codes: {sorted(missing)}")
    if not records:
        raise ValueError("No records extracted — check section boundaries")

    imported_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload = {
        "metadata": {
            "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
            "fonte_url": SOURCE_URL,
            "documento_url": PDF_URL,
            "versao_fonte": SOURCE_VERSION,
            "metodo_extracao": "PDF oficial; documento consolidado final (EI+EF+EM) — capítulo do Ensino Médio, Língua Portuguesa dentro de Linguagens e suas Tecnologias; cada habilidade casada com sua própria linha de competências específicas (nunca por captura até o próximo código, que atravessaria introduções de campo e parâmetros curriculares entre os campos)",
            "data_extracao": imported_at,
            "escopo": "Ensino Médio — Formação Geral Básica — Língua Portuguesa (dentro de Linguagens e suas Tecnologias)",
            "classificacao": "dado_oficial",
        },
        "habilidades": sorted(records, key=lambda item: item["codigo"]),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(records), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
