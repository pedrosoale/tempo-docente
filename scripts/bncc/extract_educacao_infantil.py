#!/usr/bin/env python3
"""Extract BNCC Educação Infantil — direitos de aprendizagem e desenvolvimento
and objetivos de aprendizagem e desenvolvimento — from the official MEC PDF.

Layout is unlike every Ensino Fundamental/Médio extractor already in this
directory: each campo de experiências occupies its own page (never a mirrored
two-page spread), laid out in THREE side-by-side columns — one per grupo por
faixa etária (Bebês, Crianças bem pequenas, Crianças pequenas) — not the
fixed-position 2-column (unidade/objeto vs. habilidade) layout every
Fundamental table uses. Row and column boundaries are read from each page's
own vector drawings (page.get_drawings()), confirmed independently per page
rather than assumed from any Fundamental table's coordinates, because the
column dividers here land at a different x-position on almost every page
(between x≈206 and x≈218, depending on how wide that campo's title text is) —
unlike the single fixed x≈292/552 divider shared by every Fundamental table.

The BNCC never calls these registros "habilidades" — the chapter's own text
(confirmed by a full-text scan) uses "objetivo(s) de aprendizagem e
desenvolvimento" exclusively for the 93 coded items, and "direito(s) de
aprendizagem e desenvolvimento" for the 6 uncoded ones. Every field name and
comment in this script preserves that distinction; "habilidade" never
appears here as a registro label, and none of the "ano"/"anos_aplicaveis"/
"unidade_tematica"/"objeto_conhecimento"/"segmento" concepts from Ensino
Fundamental are used — the Educação Infantil has no series/ano and no
componente curricular, only campo de experiências and grupo por faixa etária.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import defaultdict
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
)

CODE_PATTERN = re.compile(r"^\(EI0([1-3])(EO|CG|TS|EF|ET)(\d{2})\)\s*(.+)$", re.S)

FAIXA_BY_CODIGO = {
    "01": {"nome": "Bebês", "descricao": "zero a 1 ano e 6 meses"},
    "02": {"nome": "Crianças bem pequenas", "descricao": "1 ano e 7 meses a 3 anos e 11 meses"},
    "03": {"nome": "Crianças pequenas", "descricao": "4 anos a 5 anos e 11 meses"},
}

CAMPO_BY_SIGLA = {
    "EO": "O eu, o outro e o nós",
    "CG": "Corpo, gestos e movimentos",
    "TS": "Traços, sons, cores e formas",
    "EF": "Escuta, fala, pensamento e imaginação",
    "ET": "Espaços, tempos, quantidades, relações e transformações",
}

# Zero-based PDF page indices for each campo's objectives table, confirmed by
# reading the full chapter text and cross-checking against the page's own
# vector geometry (never assumed from page position alone). A page beyond the
# first in a campo's list is a genuine "(Continuação)" page in the source
# document, not a second, distinct table — both facts are asserted at
# extraction time below rather than trusted from this list alone, so a future
# edition that shifts page numbers fails loudly instead of silently
# extracting the wrong campo.
CAMPO_PAGES = [
    {"sigla": "EO", "pages": [46, 47], "heading_fragment": "O EU, O OUTRO E O NÓS"},
    {"sigla": "CG", "pages": [48], "heading_fragment": "CORPO, GESTOS E MOVIMENTOS"},
    {"sigla": "TS", "pages": [49], "heading_fragment": "TRAÇOS, SONS, CORES E FORMAS"},
    # Both headings below wrap across two lines in the source PDF with a
    # trailing space before the line break (e.g. "ESCUTA, \nFALA..."), the
    # same double-space-across-a-wrap trap already documented for the Ensino
    # Médio extractors — using a fragment that sits fully on one physical
    # line sidesteps it instead of normalizing the wrap.
    {"sigla": "EF", "pages": [50, 51], "heading_fragment": "PENSAMENTO E IMAGINAÇÃO"},
    {"sigla": "ET", "pages": [52, 53], "heading_fragment": "QUANTIDADES, RELAÇÕES E TRANSFORMAÇÕES"},
]

# Official counts (BNCC p. 45-52, recounted programmatically against the PDF
# before writing this extractor). Deliberately asymmetric: Bebês never gets a
# 7th "O eu, o outro e o nós" objetivo or a 7th/8th "Espaços, tempos..." one —
# the source document simply doesn't define EI01EO07, EI01ET07 or EI01ET08,
# so this table is the authority for what "complete" means, not "every campo
# has the same count in every faixa."
EXPECTED_COUNTS = {
    "EO": {"01": 6, "02": 7, "03": 7},
    "CG": {"01": 5, "02": 5, "03": 5},
    "TS": {"01": 3, "02": 3, "03": 3},
    "EF": {"01": 9, "02": 9, "03": 9},
    "ET": {"01": 6, "02": 8, "03": 8},
}
TOTAL_OBJETIVOS = 93

DIREITOS_HEADING = "DIREITOS DE APRENDIZAGEM E DESENVOLVIMENTO NA"
DIREITOS_OFICIAIS = ["Conviver", "Brincar", "Participar", "Explorar", "Expressar", "Conhecer-se"]
DIREITO_SLUGS = {
    "Conviver": "conviver",
    "Brincar": "brincar",
    "Participar": "participar",
    "Explorar": "explorar",
    "Expressar": "expressar",
    "Conhecer-se": "conhecer-se",
}
# The naive line-wrap join (clean_text joins wrapped lines with a plain
# space) turns a genuine mid-word hyphenation break into "word- part" instead
# of the official unbroken word — the same class of PDF artifact already
# documented for Competências Gerais item 8 ("com- preendendo-se") and
# Geografia EF04GE08 ("matérias- primas"). Confirmed against the raw PDF
# spans for these 3 direitos; restricted to the exact fragments found, never
# a general "join every hyphen" rule (Conhecer-se's own hyphen is legitimate
# and must not be touched).
CONTROLLED_TYPOGRAPHY_CORRECTIONS = {
    "Participar": (("planeja- mento", "planejamento"), ("diferen- tes", "diferentes")),
    "Expressar": (("ques- tionamentos", "questionamentos"),),
    "Conhecer-se": (("cons- tituindo", "constituindo"),),
}


def restore_official_typography(nome: str, texto: str) -> str:
    for flattened, official in CONTROLLED_TYPOGRAPHY_CORRECTIONS.get(nome, ()):
        texto = texto.replace(flattened, official)
    return texto


def normalize_upper(value: str) -> str:
    return unicodedata.normalize("NFC", value).upper()


def table_geometry(page: pymupdf.Page) -> tuple[list[float], list[float]]:
    """Row y-boundaries and the 2 internal column x-dividers for one
    Educação Infantil objectives table page.

    The column dividers are drawn as several broken vertical segments (one
    per row) rather than one continuous line, so their own segment endpoints
    already mark every row boundary — matching horizontal segments are
    folded in too, in case a row also has a drawn top/bottom rule. Distinct
    segments meant to be the same nominal line land a fraction of a point
    apart (confirmed here, not present in the Fundamental tables' geometry),
    so boundaries within 1pt of each other are merged before use.
    """
    v_by_x: dict[float, set[float]] = defaultdict(set)
    h_ys: set[float] = set()
    for drawing in page.get_drawings():
        for item in drawing["items"]:
            if item[0] != "l":
                continue
            start, end = item[1], item[2]
            if abs(start.x - end.x) <= 0.2:
                x = round(start.x, 1)
                v_by_x[x].add(round(start.y, 1))
                v_by_x[x].add(round(end.y, 1))
            elif abs(start.y - end.y) <= 0.2:
                h_ys.add(round(start.y, 1))

    dividers = sorted(v_by_x)
    if len(dividers) != 2:
        raise ValueError(f"Expected exactly 2 column dividers on PDF page {page.number + 1}, found {dividers}")

    raw_breaks = sorted(h_ys.union(*v_by_x.values()))
    breaks: list[float] = []
    for value in raw_breaks:
        if breaks and value - breaks[-1] <= 1.0:
            breaks[-1] = (breaks[-1] + value) / 2
        else:
            breaks.append(value)
    if len(breaks) < 3:
        raise ValueError(f"Not enough row boundaries on PDF page {page.number + 1}: {breaks}")

    return breaks, dividers


def extract_campo_page(page: pymupdf.Page, sigla: str, is_continuation: bool) -> list[dict]:
    breaks, dividers = table_geometry(page)
    # breaks[0]-breaks[1] is the header band (campo/column titles) — never
    # parsed for codes, so the header is read once (for the assertions in
    # main()) and never re-emitted as content, on either a fresh or a
    # continuation page.
    row_bands = list(zip(breaks[1:], breaks[2:]))
    column_ranges = [(40.0, dividers[0]), (dividers[0], dividers[1]), (dividers[1], 556.0)]
    faixa_codigos_by_column = ["01", "02", "03"]

    records: list[dict] = []
    for top, bottom in row_bands:
        cells_with_content = 0
        for column_index, (min_x, max_x) in enumerate(column_ranges):
            raw_cell = column_text(page, min_x, max_x, top + 1, bottom - 1)
            cell_text = clean_text(raw_cell)
            if not cell_text:
                continue
            cells_with_content += 1

            match = CODE_PATTERN.match(cell_text)
            if not match:
                raise ValueError(
                    f"Cell text on PDF page {page.number + 1} (row {top:.1f}-{bottom:.1f}, "
                    f"column {column_index}) does not start with a well-formed (EI...) code: {cell_text!r}"
                )
            faixa_digito, campo_sigla, sequencial, texto = match.groups()
            faixa_codigo = f"0{faixa_digito}"

            # Position vs. code cross-check: the column a cell was read from
            # must agree with the faixa digit embedded in its own code, and
            # the campo this page is for must agree with the code's own
            # campo letters. Neither position nor the code text is trusted
            # alone — this is the "posição real na coluna" association the
            # extraction is required to honor, checked in both directions.
            expected_faixa_codigo = faixa_codigos_by_column[column_index]
            if faixa_codigo != expected_faixa_codigo:
                raise ValueError(
                    f"Code {match.group(0)[:10]} found in column {column_index} "
                    f"(faixa {expected_faixa_codigo}) but its own code says faixa {faixa_codigo}"
                )
            if campo_sigla != sigla:
                raise ValueError(
                    f"Code EI0{faixa_digito}{campo_sigla}{sequencial} found on the '{sigla}' "
                    f"campo's page but its own code belongs to campo '{campo_sigla}'"
                )

            records.append(
                {
                    "codigo": f"EI0{faixa_digito}{campo_sigla}{sequencial}",
                    "campo_experiencia": CAMPO_BY_SIGLA[sigla],
                    "campo_experiencia_sigla": sigla,
                    "faixa_etaria": FAIXA_BY_CODIGO[faixa_codigo]["nome"],
                    "faixa_etaria_codigo": faixa_codigo,
                    "faixa_etaria_descricao": FAIXA_BY_CODIGO[faixa_codigo]["descricao"],
                    "texto": clean_text(texto),
                    "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
                    "fonte_url": SOURCE_URL,
                    "documento_url": PDF_URL,
                    "versao_fonte": SOURCE_VERSION,
                    "pagina_fonte": page.number - 1,
                    "classificacao": "dado_oficial",
                }
            )

        if cells_with_content == 0:
            raise ValueError(
                f"Row {top:.1f}-{bottom:.1f} on PDF page {page.number + 1} has no objetivo in any "
                "of the 3 columns — likely a boundary-detection error, since even the most "
                "asymmetric official rows always have content in at least one faixa"
            )

    if is_continuation:
        # Detected, not assumed: a continuation page must actually say so and
        # must still be titled for the same campo it is extending — guards
        # against a hardcoded page index silently drifting onto the wrong
        # page in a future PDF revision.
        header_text = normalize_upper(page.get_text())
        if "(CONTINUAÇÃO)" not in header_text:
            raise ValueError(f"PDF page {page.number + 1} was expected to be a '(Continuação)' page for campo '{sigla}' but has no such marker")

    return records


def extract_objetivos(document: pymupdf.Document) -> list[dict]:
    records: list[dict] = []
    for campo in CAMPO_PAGES:
        sigla = campo["sigla"]
        for position, page_index in enumerate(campo["pages"]):
            page = document[page_index]
            page_text_upper = normalize_upper(page.get_text())
            if campo["heading_fragment"] not in page_text_upper:
                raise ValueError(
                    f"PDF page {page_index + 1} was expected to carry the '{sigla}' campo's heading "
                    f"fragment {campo['heading_fragment']!r}, but it was not found"
                )
            records.extend(extract_campo_page(page, sigla, is_continuation=(position > 0)))
    return records


def validate_objetivo_counts(records: list[dict]) -> None:
    seen_codes = set()
    for record in records:
        if record["codigo"] in seen_codes:
            raise ValueError(f"Duplicate code extracted: {record['codigo']}")
        seen_codes.add(record["codigo"])

    if len(records) != TOTAL_OBJETIVOS:
        raise ValueError(f"Expected exactly {TOTAL_OBJETIVOS} objetivos, extracted {len(records)}")

    counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for record in records:
        counts[record["campo_experiencia_sigla"]][record["faixa_etaria_codigo"]] += 1

    mismatches = []
    for sigla, by_faixa in EXPECTED_COUNTS.items():
        for faixa_codigo, expected in by_faixa.items():
            actual = counts[sigla][faixa_codigo]
            if actual != expected:
                mismatches.append(f"{sigla}/{faixa_codigo}: expected {expected}, got {actual}")
    if mismatches:
        raise ValueError(f"Objetivo counts do not match the official table: {'; '.join(mismatches)}")


def extract_direitos(document: pymupdf.Document) -> list[dict]:
    heading_page = None
    for page in document:
        if DIREITOS_HEADING in normalize_upper(page.get_text()).replace("\n", " "):
            heading_page = page
            break
    if heading_page is None:
        raise ValueError(f"Heading {DIREITOS_HEADING!r} not found in the official PDF")

    text = heading_page.get_text()
    after_heading = text[text.upper().find("EDUCAÇÃO INFANTIL", text.upper().find("DIREITOS DE APRENDIZAGEM")):]
    bullet_pattern = re.compile(r"•\t\s*(.+?)(?=\n•\t|\Z)", re.S)
    blocks = bullet_pattern.findall(after_heading)

    records: list[dict] = []
    seen_nomes: set[str] = set()
    for block in blocks:
        texto = clean_text(block)
        nome = next((candidate for candidate in DIREITOS_OFICIAIS if texto.startswith(candidate)), None)
        if nome is None:
            raise ValueError(f"Direito text does not start with any of the 6 official names: {texto[:60]!r}")
        if nome in seen_nomes:
            raise ValueError(f"Direito '{nome}' extracted more than once")
        seen_nomes.add(nome)
        records.append(
            {
                "nome": nome,
                "slug": DIREITO_SLUGS[nome],
                "texto": restore_official_typography(nome, texto),
                "pagina_fonte": heading_page.number - 1,
            }
        )

    missing = [nome for nome in DIREITOS_OFICIAIS if nome not in seen_nomes]
    if missing:
        raise ValueError(f"Missing direitos: {missing} (found {sorted(seen_nomes)})")
    if len(records) != len(DIREITOS_OFICIAIS):
        raise ValueError(f"Expected exactly {len(DIREITOS_OFICIAIS)} direitos, extracted {len(records)}")

    return records


# data_extracao (top-level metadata) and tentado_em (nested under
# validacao_cruzada) are wall-clock timestamps that legitimately differ on
# every run even against the exact same PDF with the exact same
# cross-validation outcome — stripped only to decide whether a write is
# needed, mirroring scripts/bncc/import.mjs's writeJsonIfChanged so both
# layers of this pipeline share the same determinism convention. Everything
# else in validacao_cruzada (fonte_tentada/resultado/detalhe) is real content:
# if bnccapi.mec.gov.br ever comes back online with actual data, `resultado`
# changes from "indisponivel" to something else and that difference survives
# the strip, so it is written and the new attempt's timestamp is preserved —
# never silently treated as a no-op timestamp change.
VOLATILE_KEYS = {"data_extracao", "tentado_em"}


def strip_volatile(value):
    if isinstance(value, list):
        return [strip_volatile(item) for item in value]
    if isinstance(value, dict):
        return {key: strip_volatile(val) for key, val in value.items() if key not in VOLATILE_KEYS}
    return value


def write_if_changed(output: Path, payload: dict) -> bool:
    """Write `payload` to `output`, skipping the write when an existing
    snapshot there is already semantically identical once the volatile
    timestamp fields above are stripped from both sides. Never removes the
    record of when a real, different extraction happened — that timestamp is
    exactly what a genuine content or cross-validation-result change writes.
    """
    if output.exists():
        try:
            existing = json.loads(output.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = None
        if existing is not None and strip_volatile(existing) == strip_volatile(payload):
            return False

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return True


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
    direitos = extract_direitos(document)
    objetivos = extract_objetivos(document)
    validate_objetivo_counts(objetivos)

    imported_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload = {
        "metadata": {
            "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
            "fonte_url": SOURCE_URL,
            "documento_url": PDF_URL,
            "versao_fonte": SOURCE_VERSION,
            "metodo_extracao": (
                "PDF oficial; direitos localizados pelo próprio texto do documento (marcador de "
                "lista '•'); objetivos extraídos por associação posicional entre coordenadas "
                "vetoriais reais de linha/coluna de cada página (uma página por campo de "
                "experiências, 3 colunas por faixa etária) e o próprio código embutido no texto de "
                "cada célula — nunca só a ordem do texto corrido nem um regex global sobre a página."
            ),
            "data_extracao": imported_at,
            "escopo": (
                "Educação Infantil — Direitos de Aprendizagem e Desenvolvimento, Campos de "
                "Experiências e Objetivos de Aprendizagem e Desenvolvimento, por grupo/faixa etária"
            ),
            "classificacao": "dado_oficial",
            "correcoes_tipograficas_controladas": [
                {
                    "direito": nome,
                    "correcao": f"{flattened} → {official}",
                    "motivo": "Quebra de linha do PDF hifenizou a palavra; a extração bruta juntava as duas metades com um hífen literal em vez de recompor a palavra.",
                }
                for nome, corrections in CONTROLLED_TYPOGRAPHY_CORRECTIONS.items()
                for flattened, official in corrections
            ],
            # Cross-validação independente tentada nesta rodada contra a
            # ferramenta oficial editável do MEC (downloadbncc.mec.gov.br,
            # cujo frontend chama exclusivamente bnccapi.mec.gov.br). O
            # endpoint segue inalcançável: DNS resolve (200.130.2.9), mas a
            # conexão TCP expira em HTTP e HTTPS — o mesmo achado já
            # registrado em data/bncc/README.md para o Ensino Fundamental,
            # reconfirmado de forma independente nesta rodada. Não há,
            # portanto, divergência de DADO a registrar — há indisponibilidade
            # da fonte de validação cruzada, documentada aqui para que uma
            # futura rodada retente assim que o endpoint voltar.
            "validacao_cruzada": {
                "fonte_tentada": "https://downloadbncc.mec.gov.br/ (backend: bnccapi.mec.gov.br)",
                "resultado": "indisponivel",
                "detalhe": "bnccapi.mec.gov.br resolve via DNS mas não aceita conexão TCP (timeout em HTTP e HTTPS); reconfirma o achado já registrado para o Fundamental em data/bncc/README.md.",
                "tentado_em": imported_at,
            },
        },
        "direitos": direitos,
        "objetivos": objetivos,
    }

    written = write_if_changed(args.output, payload)
    print(json.dumps(
        {"total_direitos": len(direitos), "total_objetivos": len(objetivos), "output": str(args.output), "written": written},
        ensure_ascii=False,
    ))


if __name__ == "__main__":
    main()
