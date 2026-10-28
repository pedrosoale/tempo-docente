"""Conferência INDEPENDENTE do texto extraído do Anexo: compara, página a página, o multiconjunto de
letras e dígitos que o extrator (PyMuPDF, scripts/bncc-computacao/extrair_anexo.py) pôs nas células com
o que um segundo motor de leitura de PDF (pypdf) lê na mesma página, descontados cabeçalhos, rodapés e
títulos de tabela.

Oferece uma verificação independente de cobertura textual por página e ajuda a detectar omissões,
duplicações ou deslocamentos entre páginas. Como compara multiconjuntos normalizados de caracteres, não
valida a ordem do texto nem a atribuição entre células da mesma página; essas dimensões dependem da
extração geométrica e da conferência visual documentada.

(O pdftotext/xpdf 4.00 disponível na máquina de auditoria não abre este PDF — "Couldn't read xref table";
por isso o segundo motor é o pypdf.)

Uso: python scripts/bncc-computacao/conferir_texto_independente.py <Anexo.pdf> <bruto.json>
onde <bruto.json> é gerado por `extrair_anexo.py --bruto <arquivo>`.
Saída esperada: apenas as páginas 5 e 15 com letras maiúsculas sobrando em "faltando" (os títulos grandes
"EDUCAÇÃO INFANTIL" e "A ETAPA DO ENSINO FUNDAMENTAL" não são cabeçalhos de tabela) e "sobrando" sempre vazio.
"""

import collections
import json
import re
import sys
import unicodedata

import pypdf

PDF, BRUTO = sys.argv[1], sys.argv[2]
LEITOR = pypdf.PdfReader(PDF)

BOILER = re.compile(
    r"EXPLICAÇÃODAHABILIDADE|EXEMPLOS|OBJETODECONHECIMENTO|OBJETIVODEAPRENDIZAGEM|COMPETÊNCIAESPECÍFICA"
    r"|ENSINOFUNDAMENTAL|ENSINOMÉDIO|EDUCAÇÃOINFANTIL|AETAPADO|AETAPADA|COMPETÊNCIAS|PREMISSAS"
    r"|EIXO|HABILIDADE|Diagramação:.*"
)


def norm(texto):
    texto = unicodedata.normalize("NFC", texto.replace("­", ""))
    return "".join(ch for ch in texto if ch.isalnum())


def texto_pypdf(pagina):
    return unicodedata.normalize("NFC", LEITOR.pages[pagina - 1].extract_text() or "")


def ruido(texto):
    """Letras de cabeçalhos/rodapés/títulos (o pypdf devolve o texto sem espaços entre palavras)."""
    contagem = collections.Counter()
    for linha in texto.splitlines():
        linha = re.sub(r"\s+", "", linha)
        if not linha:
            continue
        if re.fullmatch(r"\d{1,3}", linha) or linha.startswith("COMPUTAÇÃO"):
            contagem.update(norm(linha))
            continue
        if linha.isupper():
            for m in BOILER.finditer(linha):
                contagem.update(norm(m.group(0)))
        elif BOILER.sub("", linha) == "":
            contagem.update(norm(linha))
    return contagem


dados = json.load(open(BRUTO, encoding="utf-8"))
por_pagina = collections.defaultdict(collections.Counter)
vistos = set()


def somar(pagina, valor, chave=None):
    if not valor:
        return
    if chave is not None:
        if (pagina, chave) in vistos:
            return
        vistos.add((pagina, chave))
    por_pagina[pagina].update(norm(valor))


for grupo in ("ei", "ef", "em"):
    for r in dados["bruto"][grupo]:
        pe, pd = r["pagina_fonte"], r["pagina_fonte_complemento"]
        somar(pe, "(" + r["codigo_impresso"] + ") " + r["texto"])
        for campo in ("eixo_impresso", "objeto_conhecimento", "objeto_conhecimento_nivel_2", "enunciado_agrupador", "competencia_texto"):
            somar(pe, r.get(campo), chave=(campo, r.get(campo)))  # célula mesclada: conta uma vez por página
        somar(pd, "\n".join(r["explicacao_blocos"]))
        somar(pd, "\n".join(r["exemplos"]))
somar(5, dados["premissas_introducao"])
for chave, pg in (("competencias_ef", 15), ("competencias_em", 65), ("premissas_ei", 5)):
    for c in dados[chave]:
        somar(pg, f'{c["numero"]}. ' + c["texto"])

com_diferenca = 0
for n in sorted(por_pagina):
    texto = texto_pypdf(n)
    esperado = collections.Counter(norm(texto)) - ruido(texto)
    faltando = esperado - por_pagina[n]
    sobrando = por_pagina[n] - collections.Counter(norm(texto))
    if faltando or sobrando:
        com_diferenca += 1
        print(f"pág {n}: faltando={''.join(k * v for k, v in sorted(faltando.items()))!r} sobrando={''.join(k * v for k, v in sorted(sobrando.items()))!r}")
print("páginas conferidas:", len(por_pagina), "| com diferença:", com_diferenca)
