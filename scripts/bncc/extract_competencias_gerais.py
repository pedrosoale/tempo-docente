#!/usr/bin/env python3
"""Extract the 10 official Competências Gerais da Educação Básica from the BNCC PDF.

Locates the "COMPETÊNCIAS GERAIS DA EDUCAÇÃO BÁSICA" heading by searching the
PDF's own text layer (no hardcoded page index), then reads the ten numbered
items across as many pages as needed. It never rewrites official text.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

PDF_URL = "https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf"
SOURCE_URL = "https://basenacionalcomum.mec.gov.br/abase/"
# The file at PDF_URL keeps its original EI/EF-era filename, but its internal
# metadata (checked with `doc.metadata` during this extraction) shows
# creationDate 2018-12-13 and modDate 2018-12-19 -- squarely inside the
# Ensino Médio homologation window (Dec/2018). It is the consolidated final
# document, not an EI/EF-only file. The Competências Gerais apply to all of
# Educação Básica, so they are recorded under "etapa": "Educação Básica"
# rather than tied to any single stage.
SOURCE_VERSION = "Base Nacional Comum Curricular — documento consolidado final (metadados internos do arquivo: criado em 13/12/2018, modificado em 19/12/2018)"

HEADING = "COMPETÊNCIAS GERAIS DA EDUCAÇÃO BÁSICA"
ITEM_PATTERN = re.compile(r"(?m)^(\d{1,2})\.\t(.+?)(?=\n\d{1,2}\.\t|\Z)", re.S)
MAX_LOOKAHEAD_PAGES = 5
TOTAL_COMPETENCIAS = 10

# The PDF line-wraps "compreendendo-se" across two lines as "com-" / "preendendo-se"
# in item 8. Plain whitespace joining turns that into "com- preendendo-se", which
# is not the official word. Keep the correction item-specific and documented so
# other hyphens (e.g. genuine compounds like "visual-motora") are never touched.
CONTROLLED_TYPOGRAPHY_CORRECTIONS = {
    8: (("com- preendendo-se", "compreendendo-se"),),
}


def clean_text(value: str) -> str:
    value = unicodedata.normalize("NFC", value.replace("­", ""))
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
    return " ".join(line for line in lines if line)


def restore_official_typography(item: dict) -> dict:
    for flattened, official in CONTROLLED_TYPOGRAPHY_CORRECTIONS.get(item["numero"], ()):
        item["texto"] = item["texto"].replace(flattened, official)
    return item


def find_heading_page(document: pymupdf.Document) -> int:
    for page in document:
        if HEADING in page.get_text().upper().replace("\n", " "):
            return page.number
    raise ValueError(f"Heading {HEADING!r} not found in the official PDF")


def extract_items(document: pymupdf.Document, start_page: int) -> list[dict]:
    found: dict[int, dict] = {}
    for offset in range(MAX_LOOKAHEAD_PAGES):
        page = document[start_page + offset]
        text = page.get_text()
        for number, body in ITEM_PATTERN.findall(text):
            numero = int(number)
            if numero in found:
                continue
            found[numero] = {"numero": numero, "texto": clean_text(body), "pagina_fonte": page.number}
        if len(found) >= TOTAL_COMPETENCIAS:
            break

    missing = [n for n in range(1, TOTAL_COMPETENCIAS + 1) if n not in found]
    if missing:
        raise ValueError(f"Missing Competências Gerais items: {missing} (found {sorted(found)})")

    extra = [n for n in found if n < 1 or n > TOTAL_COMPETENCIAS]
    if extra:
        raise ValueError(f"Unexpected item numbers outside 1-10: {extra}")

    return [found[n] for n in range(1, TOTAL_COMPETENCIAS + 1)]


def download_pdf(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(PDF_URL, headers={"User-Agent": "TempoDocente-BNCC-Importer/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response, destination.open("wb") as output:
        output.write(response.read())


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
    heading_page = find_heading_page(document)
    items = [restore_official_typography(item) for item in extract_items(document, heading_page)]

    imported_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload = {
        "metadata": {
            "fonte": "Base Nacional Comum Curricular — Ministério da Educação",
            "fonte_url": SOURCE_URL,
            "documento_url": PDF_URL,
            "versao_fonte": SOURCE_VERSION,
            "metodo_extracao": "PDF oficial; localização da seção pelo próprio texto do documento, itens numerados 1-10 extraídos por padrão de marcador de lista",
            "data_extracao": imported_at,
            "escopo": "Competências Gerais da Educação Básica (aplicam-se à Educação Infantil, ao Ensino Fundamental e ao Ensino Médio)",
            "classificacao": "dado_oficial",
            "correcoes_tipograficas_controladas": [
                {
                    "numero": numero,
                    "correcao": f"{flattened} → {official}",
                    "motivo": "Quebra de linha do PDF hifenizou a palavra; a extração bruta juntava as duas metades com um hífen literal em vez de recompor a palavra.",
                }
                for numero, corrections in CONTROLLED_TYPOGRAPHY_CORRECTIONS.items()
                for flattened, official in corrections
            ],
        },
        "competencias": items,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"total": len(items), "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
