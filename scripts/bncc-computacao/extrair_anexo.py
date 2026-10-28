"""Extrator do Anexo ao Parecer CNE/CEB nº 2/2022 — "Computação na Educação Básica —
Complemento à BNCC" (PDF oficial do MEC/CNE, hospedado em www.gov.br/mec).

Gera os QUATRO arquivos-fonte versionados em data/bncc/source/ (um por etapa); o catálogo final
é produzido depois, só por scripts/bncc-computacao/gerar.mjs.

Uso (rodar a partir de um diretório que NÃO seja o dos dados baixados):

    python scripts/bncc-computacao/extrair_anexo.py --pdf <Anexo.pdf> --saida <diretorio-de-fontes>
                                                    [--revisao <arquivo.txt>]

Princípios (mesmos de scripts/bncc/extract_educacao_infantil.py):
  * O PDF é uma tabela larga cortada em DUAS páginas espelhadas (esquerda: eixo / objeto de
    conhecimento / habilidade; direita: explicação / exemplos). As linhas horizontais da grade da
    página direita delimitam cada linha da tabela; a MESMA faixa vertical na página esquerda traz a
    habilidade correspondente. A atribuição é sempre geométrica (faixa de linha × coluna) — nunca a
    ordem do texto corrido, e o texto de uma célula é centralizado verticalmente, então nem mesmo a
    posição inicial do texto serve de critério.
  * Cada faixa de linha precisa conter EXATAMENTE um código de habilidade; qualquer divergência
    interrompe a extração.
  * Nenhuma correção tipográfica é aplicada globalmente: as únicas exceções ficam em CORRECOES, cada
    uma ligada a um registro específico e com o trecho impresso na fonte preservado ao lado.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import statistics
import sys
import unicodedata
from pathlib import Path

import pymupdf

ANEXO_URL = "https://www.gov.br/mec/pt-br/cne/pdf/pareceres-do-cne/ceb/2022/anexo-ao-parecer-cneceb-no-2-2022-bncc-computacao.pdf"
ANEXO_SHA256 = "b0f021db3c7c2c042b821cec5fab7d77ed1888dbb61590461ce2afef404865b7"
ANEXO_TAMANHO = 1426596
ANEXO_PAGINAS = 75
DESLOCAMENTO_PAGINA_IMPRESSA = 4  # página real do PDF − página impressa (confirmado em cada página lida)

CODIGO = re.compile(r"^\((E[IFM]\d{0,2}CO\d{2,3})\)\s*")
EIXOS = {
    "PENSAMENTO COMPUTACIONAL": "Pensamento Computacional",
    "MUNDO DIGITAL": "Mundo Digital",
    "CULTURA DIGITAL": "Cultura Digital",
}
MARCADOR_ITEM = re.compile(r"^(\(?[ivx]+\)|\d+\)|\(\d+\)|[-•–]\s|Passo \(\d+\))")

# Pares (página esquerda, tipo) de cada tabela do Anexo — a página direita é sempre a seguinte.
PARES_EI = [6, 8, 10, 12]
PARES_EF = list(range(16, 64, 2))
PARES_EM = [66, 68, 70, 72, 74]

# Única correção tipográfica controlada desta fonte (ver data/bncc/README.md, "Correções tipográficas
# controladas"): o PDF imprime "(EF05CO011)", com três dígitos, para o 11º objetivo do 5º ano; a
# sequência impressa é EF05CO01…EF05CO10 e a regra de formação do código (EF + 2 dígitos de ano + CO +
# 2 dígitos) não admite três dígitos. Nenhuma outra forma de correção é aplicada.
CORRECOES = [
    {
        "codigo_corrigido": "EF05CO11",
        "codigo_impresso_na_fonte": "EF05CO011",
        "pagina_fonte": 36,
        "natureza": "codigo_com_digito_a_mais",
        "justificativa": "O 11º código do 5º ano é impresso como (EF05CO011), com três dígitos; o padrão de todos os "
        "outros 140 códigos do Anexo é EF/EI/EM + 2 dígitos + CO + exatamente 2 dígitos, e a sequência impressa do "
        "5º ano é contínua de EF05CO01 a EF05CO10 — a leitura EF05CO11 é a única compatível com o padrão e com a "
        "sequência. Conferido visualmente na página renderizada.",
    }
]


def nfc(texto: str) -> str:
    return unicodedata.normalize("NFC", texto.replace("­", ""))


def linhas_de(pagina):
    saida = []
    for bloco in pagina.get_text("dict")["blocks"]:
        if bloco["type"] != 0:
            continue
        for ln in bloco["lines"]:
            texto = nfc("".join(s["text"] for s in ln["spans"]))
            if not texto.strip():
                continue
            x0, y0, x1, y1 = ln["bbox"]
            saida.append({"x0": x0, "y0": y0, "x1": x1, "y1": y1, "texto": texto.rstrip(), "tamanho": ln["spans"][0]["size"]})
    return saida


def linhas_h(pagina):
    achados = []
    for dr in pagina.get_drawings():
        if dr["type"] != "s":
            continue
        for it in dr["items"]:
            if it[0] == "l":
                a, b = it[1], it[2]
                if abs(a.y - b.y) < 0.2:
                    achados.append((round(a.y, 1), min(a.x, b.x), max(a.x, b.x)))
    return sorted(set(achados))


def linhas_v(pagina, y_min=0, y_max=900):
    achados = set()
    for dr in pagina.get_drawings():
        if dr["type"] != "s":
            continue
        for it in dr["items"]:
            if it[0] == "l":
                a, b = it[1], it[2]
                if abs(a.x - b.x) < 0.2 and abs(a.y - b.y) > 5 and min(a.y, b.y) >= y_min - 1 and max(a.y, b.y) <= y_max + 1:
                    achados.add(round(a.x, 1))
    return sorted(achados)


def corpo_da_tabela(pagina):
    """(topo, base) do corpo cinza da tabela — o maior retângulo preenchido (o cabeçalho colorido é baixo)."""
    candidatos = [dr["rect"] for dr in pagina.get_drawings() if dr["type"] == "f" and dr["rect"].height > 60]
    if not candidatos:
        raise ValueError(f"corpo da tabela não encontrado na página {pagina.number + 1}")
    r = max(candidatos, key=lambda r: r.height)
    return round(r.y0, 1), round(r.y1, 1)


def bandas_de(bordas_internas, topo, base):
    bordas = [topo] + sorted(set(bordas_internas)) + [base]
    return [(bordas[i], bordas[i + 1]) for i in range(len(bordas) - 1)]


def titulo_da_pagina(pagina):
    achado = None
    for ln in linhas_de(pagina):
        if ln["tamanho"] > 14 and ln["y0"] < 130:
            achado = ln["texto"].strip()
    if not achado:
        raise ValueError(f"título não encontrado na página {pagina.number + 1}")
    return achado


def numero_impresso(pagina):
    candidatos = [ln for ln in linhas_de(pagina) if re.fullmatch(r"\d{1,3}", ln["texto"].strip()) and ln["y0"] > 795]
    if len(candidatos) != 1:
        raise ValueError(f"número de página impresso ambíguo/ausente na página {pagina.number + 1}: {candidatos}")
    return int(candidatos[0]["texto"].strip())


def dentro(ln, x_min, x_max, y_min, y_max):
    cx = (ln["x0"] + ln["x1"]) / 2
    cy = (ln["y0"] + ln["y1"]) / 2
    return x_min <= cx < x_max and y_min <= cy < y_max


def montar_celula(linhas, juncoes, contexto):
    """Converte as linhas visuais de UMA célula em blocos de texto.

    Blocos são separados por linha em branco na fonte (espaçamento vertical > 1,45× o passo normal).
    Dentro do bloco, uma linha visual inicia um novo item (quebra '\\n') se começar por marcador de lista
    ('1)', '(i)', '-', 'Passo (n)'), ou se a anterior terminar em ':' / for curta e terminar em pontuação
    forte; caso contrário, é continuação da mesma frase (junta com espaço, ou sem espaço quando a anterior
    termina em hífen e a próxima começa em minúscula — registrado em `juncoes` para revisão visual).
    """
    if not linhas:
        return []
    linhas = sorted(linhas, key=lambda l: (round(l["y0"], 1), l["x0"]))
    passos = [round(b["y0"] - a["y0"], 1) for a, b in zip(linhas, linhas[1:]) if b["y0"] - a["y0"] > 2]
    passo = collections.Counter(passos).most_common(1)[0][0] if passos else (linhas[0]["y1"] - linhas[0]["y0"]) * 1.2
    largura = max(l["x1"] for l in linhas) - min(l["x0"] for l in linhas)
    blocos, atual = [], [linhas[0]]
    for ant, ln in zip(linhas, linhas[1:]):
        if ln["y0"] - ant["y0"] > passo * 1.45:
            blocos.append(atual)
            atual = [ln]
        else:
            atual.append(ln)
    blocos.append(atual)
    saida = []
    for bloco in blocos:
        itens = [bloco[0]["texto"].strip()]
        for ant, ln in zip(bloco, bloco[1:]):
            t = ln["texto"].strip()
            anterior = itens[-1]
            curta = (ant["x1"] - ant["x0"]) < 0.92 * largura
            inicia_maiuscula = t[:1].isupper() or t[:1] in "(•-–“\"'"
            novo_item = (
                bool(MARCADOR_ITEM.match(t))
                or (anterior.endswith(":") and not t[:1].islower())
                or (curta and anterior[-1:] in ".;?!)" and inicia_maiuscula)
            )
            if novo_item:
                itens.append(t)
            elif anterior.endswith("-") and t[:1].islower():
                # O PDF não tem hifenização automática (toda quebra após hífen é um hífen impresso do próprio
                # texto: "pré-definido", "vice-versa"): mantém o hífen e junta sem espaço.
                juncoes.append({"tipo": "hifen", "contexto": contexto, "fim_da_linha": anterior[-28:], "inicio_da_proxima": t[:28]})
                itens[-1] = anterior + t
            elif anterior.endswith("//") or (anterior.endswith("/") and len(anterior) > 1 and not anterior[-2].isspace()):
                # Quebra após "/" em URL ("http://" + "www…") ou em "palavra/palavra": o fluxo de texto do PDF não traz
                # espaço nas quebras de linha; inserir um espaço criaria uma URL/expressão que o documento não imprime.
                juncoes.append({"tipo": "barra", "contexto": contexto, "fim_da_linha": anterior[-28:], "inicio_da_proxima": t[:28]})
                itens[-1] = anterior + t
            else:
                itens[-1] = anterior + " " + t
        saida.append("\n".join(re.sub(r"[ \t]+", " ", i) for i in itens))
    return saida


def colunas_da_pagina(esq, tipo):
    """Colunas da página esquerda, lidas das linhas verticais da grade (nunca de x fixo)."""
    xs = sorted({x for x in linhas_v(esq, 0, 900) if 60 < x < 600})
    if tipo == "ef" and len(xs) >= 5:  # 6º–9º ano e 6º ao 9º: objeto em dois níveis + enunciado agrupador
        x1, x2, x3, x4, x5 = xs[-5:]
        return {"eixo": (0, x1), "obj1": (x1, x2), "obj2": (x2, x3), "desc": (x3, x4), "hab": (x4, x5)}, True
    if tipo == "ef":
        x_obj, x_hab, x_dir = xs[-3:]
        return {"eixo": (0, x_obj), "obj1": (x_obj, x_hab), "hab": (x_hab, x_dir)}, False
    x_hab, x_dir = xs[-2:]
    return {"eixo" if tipo == "ei" else "comp": (0, x_hab), "hab": (x_hab, x_dir)}, False


def extrair_par(doc, n_esq, tipo, juncoes, avisos):
    esq, dir_ = doc[n_esq - 1], doc[n_esq]
    titulo = titulo_da_pagina(esq)
    topo, base = corpo_da_tabela(dir_)
    if (topo, base) != corpo_da_tabela(esq):
        raise ValueError(f"página {n_esq}: corpo da tabela diverge entre as páginas espelhadas")
    impressa_esq, impressa_dir = numero_impresso(esq), numero_impresso(dir_)
    for real, imp in ((n_esq, impressa_esq), (n_esq + 1, impressa_dir)):
        if real - imp != DESLOCAMENTO_PAGINA_IMPRESSA:
            raise ValueError(f"página real {real} com número impresso {imp}: deslocamento ≠ {DESLOCAMENTO_PAGINA_IMPRESSA}")

    colunas, hierarquica = colunas_da_pagina(esq, tipo)
    h_esq = linhas_h(esq)
    lin_esq, lin_dir = linhas_de(esq), linhas_de(dir_)
    hab = colunas["hab"]

    def bandas_da_coluna(nome):
        """Faixas (células mescladas) de uma coluna: bordas horizontais que a atravessam."""
        esquerda = max(colunas[nome][0], 56.7)
        ys = {y for y, x0, x1 in h_esq if x0 <= esquerda + 2 and x1 > esquerda + 4 and topo + 1 < y < base - 1}
        return bandas_de(ys, topo, base)

    bandas = bandas_da_coluna("hab")
    bordas_dir = {y for y, x0, x1 in linhas_h(dir_) if x0 < 0 and x1 > 500 and topo + 1 < y < base - 1}
    bandas_dir = bandas_de(bordas_dir, topo, base)
    for b in bandas:
        for borda in b:
            if not any(abs(borda - d) < 0.6 for e in bandas_dir for d in e):
                raise ValueError(f"página {n_esq}: borda {borda} da esquerda ausente nas linhas da direita")
    bandas_col = {nome: bandas_da_coluna(nome) for nome in colunas if nome != "hab"}

    def celula(nome, y_meio, titulo_ctx):
        banda = next(b for b in bandas_col[nome] if b[0] <= y_meio < b[1])
        sel = [l for l in lin_esq if dentro(l, colunas[nome][0], colunas[nome][1], banda[0], banda[1]) and l["tamanho"] < 14]
        if nome == "eixo":
            # rótulo rotacionado (pode ter 2 linhas): usa a ordem de leitura do PRÓPRIO bloco do PDF, sem reordenar
            return nfc(" ".join(l["texto"].strip() for l in sel))
        blocos = montar_celula(sel, juncoes, titulo_ctx)
        return nfc(" ".join(b.replace(chr(10), " ") for b in blocos))

    # divisória explicação | exemplos na página direita (EI tem só a coluna de exemplos)
    div = None
    if tipo != "ei":
        v_dir = [x for x in linhas_v(dir_, 0, 900) if 100 < x < 520]
        if v_dir:
            div = v_dir[0]
        else:
            x0s = sorted(l["x0"] for l in lin_dir if topo < l["y0"] < base and l["tamanho"] < 14)
            lacunas = [(b - a, (a + b) / 2) for a, b in zip(x0s, x0s[1:])]
            maior = max(lacunas)
            if maior[0] < 100:
                raise ValueError(f"divisória explicação/exemplos não determinada na página {n_esq + 1}")
            div = maior[1]

    resultado = []
    for banda in bandas:
        codigos = [l for l in lin_esq if CODIGO.match(l["texto"].strip()) and dentro(l, hab[0], hab[1], banda[0], banda[1])]
        if len(codigos) != 1:
            raise ValueError(f"página {n_esq}, faixa {banda}: esperado exatamente 1 código de habilidade, achei {len(codigos)}")
        cel = [l for l in lin_esq if dentro(l, hab[0], hab[1], banda[0], banda[1]) and l["tamanho"] < 14]
        blocos_hab = montar_celula(cel, juncoes, f"p{n_esq} habilidade")
        if len(blocos_hab) != 1:
            avisos.append(f"p{n_esq} faixa {banda}: texto da habilidade com {len(blocos_hab)} blocos")
        bruto = blocos_hab[0].replace(chr(10), " ")
        m = CODIGO.match(bruto)
        codigo_impresso, texto = m.group(1), bruto[m.end():].strip()

        meio = (banda[0] + banda[1]) / 2
        ctx = f"p{n_esq} {codigo_impresso}"
        eixo = celula("eixo", meio, ctx) if "eixo" in colunas else None
        objeto1 = celula("obj1", meio, ctx) if "obj1" in colunas else None
        objeto2 = celula("obj2", meio, ctx) if "obj2" in colunas else None
        enunciado = celula("desc", meio, ctx) if "desc" in colunas else None
        competencia = celula("comp", meio, ctx) if "comp" in colunas else None

        subs = [d for d in bandas_dir if banda[0] - 0.6 <= d[0] and d[1] <= banda[1] + 0.6]
        explic, exemplos = [], []
        for sb in subs:
            if tipo == "ei":
                ex = [l for l in lin_dir if dentro(l, 0, 600, sb[0], sb[1]) and l["tamanho"] < 14]
                exemplos += montar_celula(ex, juncoes, f"p{n_esq + 1} exemplos {codigo_impresso}")
            else:
                ce = [l for l in lin_dir if dentro(l, 0, div, sb[0], sb[1]) and l["tamanho"] < 14]
                cx = [l for l in lin_dir if dentro(l, div, 600, sb[0], sb[1]) and l["tamanho"] < 14]
                explic += montar_celula(ce, juncoes, f"p{n_esq + 1} explicação {codigo_impresso}")
                exemplos += montar_celula(cx, juncoes, f"p{n_esq + 1} exemplos {codigo_impresso}")
        resultado.append(
            {
                "codigo_impresso": codigo_impresso,
                "texto": texto,
                "eixo_impresso": eixo,
                "objeto_conhecimento": objeto1,
                "objeto_conhecimento_nivel_2": objeto2,
                "enunciado_agrupador": enunciado,
                "competencia_texto": competencia,
                "explicacao_blocos": explic,
                "exemplos": exemplos,
                "linhas_na_pagina_complemento": len(subs),
                "pagina_fonte": n_esq,
                "pagina_impressa": impressa_esq,
                "pagina_fonte_complemento": n_esq + 1,
                "pagina_impressa_complemento": impressa_dir,
                "quadro": titulo,
            }
        )
    return resultado


def competencias_numeradas(doc, pagina_n, ate_marca=None):
    """Competências numeradas ('1.', '2.', …) de uma página; cada item é um bloco de linhas até o próximo número."""
    pg = doc[pagina_n - 1]
    ls = sorted([l for l in linhas_de(pg) if l["tamanho"] < 14 and l["y0"] > 90 and l["y0"] < 790], key=lambda l: (round(l["y0"], 1), l["x0"]))
    itens, atual = [], None
    for ln in ls:
        t = ln["texto"].strip()
        if re.fullmatch(r"\d+\.", t):
            atual = [int(t[:-1]), []]
            itens.append(atual)
        elif atual is not None:
            atual[1].append(t)
    saida = []
    for n, partes in itens:
        saida.append({"numero": n, "texto": nfc(" ".join(partes))})
    return saida


def introducao_das_premissas(doc, pagina_n=5):
    """Parágrafo que antecede o item '1.' das premissas da Educação Infantil (texto oficial, não é um registro)."""
    pg = doc[pagina_n - 1]
    ls = sorted([l for l in linhas_de(pg) if l["tamanho"] < 14 and 90 < l["y0"] < 790], key=lambda l: (round(l["y0"], 1), l["x0"]))
    partes, ativo = [], False
    for ln in ls:
        t = ln["texto"].strip()
        if t == "PREMISSAS":
            ativo = True
            continue
        if re.fullmatch(r"\d+\.", t):
            break
        if ativo:
            partes.append(t)
    return nfc(" ".join(partes))


def hash_arquivo(caminho):
    return hashlib.sha256(Path(caminho).read_bytes()).hexdigest()


# ---------------------------------------------------------------------------------------------------------
# Estágio 2: monta os quatro arquivos-fonte (um por etapa) a partir das células extraídas.
# ---------------------------------------------------------------------------------------------------------
NOME_OFICIAL = "Computação na Educação Básica — Complemento à BNCC"
NOME_CURTO = "BNCC Computação"

DOCUMENTOS = {
    "anexo": {
        "id": "anexo-parecer-ceb-2-2022",
        "titulo": "Anexo ao Parecer CNE/CEB nº 2/2022 — Computação na Educação Básica: Complemento à BNCC (tabelas de competências e habilidades)",
        "orgao": "Ministério da Educação — Conselho Nacional de Educação (CNE/CEB)",
        "url": ANEXO_URL,
        "sha256": ANEXO_SHA256,
        "tamanho_bytes": ANEXO_TAMANHO,
        "total_paginas_pdf": ANEXO_PAGINAS,
        "mime": "application/pdf",
        "http": {"status": 200, "redirecionamentos": 0, "url_final": ANEXO_URL},
        "acessado_em": "2026-10-28T11:35:46Z",
        "papel": "fonte_das_tabelas",
    },
    "anexo_equivalente_gov_br_media": {
        "id": "bncc-computacao-gov-br-media",
        "titulo": "BNCC Computação na Educação Básica.pdf (gov.br/mec/pt-br/media) — byte a byte idêntico ao Anexo",
        "orgao": "Ministério da Educação",
        "url": "https://www.gov.br/mec/pt-br/media/bncc-computacao-na-educacao-basica.pdf",
        "sha256": ANEXO_SHA256,
        "tamanho_bytes": ANEXO_TAMANHO,
        "total_paginas_pdf": ANEXO_PAGINAS,
        "mime": "application/pdf",
        "http": {"status": 200, "redirecionamentos": 0, "url_final": "https://www.gov.br/mec/pt-br/media/bncc-computacao-na-educacao-basica.pdf"},
        "acessado_em": "2026-10-28T11:38:45Z",
        "papel": "equivalente_oficial_identico_ao_anexo",
    },
    "parecer": {
        "id": "parecer-ceb-2-2022",
        "titulo": "Parecer CNE/CEB nº 2/2022 — Normas sobre Computação na Educação Básica – Complemento à Base Nacional Comum Curricular (BNCC)",
        "orgao": "Ministério da Educação — Conselho Nacional de Educação (CNE/CEB)",
        "url": "https://www.gov.br/mec/pt-br/cne/pdf/pareceres-do-cne/ceb/2022/pceb002_22.pdf",
        "sha256": "03fa6616e7b92b9f382b3c4177acce23b49b6fe8e2d787fc86326908179fa144",
        "tamanho_bytes": 617783,
        "total_paginas_pdf": 34,
        "mime": "application/pdf",
        "http": {"status": 200, "redirecionamentos": 0, "url_final": "https://www.gov.br/mec/pt-br/cne/pdf/pareceres-do-cne/ceb/2022/pceb002_22.pdf"},
        "acessado_em": "2026-10-28T11:35:46Z",
        "papel": "fundamento_normativo",
    },
    "resolucao": {
        "id": "resolucao-ceb-1-2022",
        "titulo": "Resolução CNE/CEB nº 1, de 4 de outubro de 2022 — Normas sobre Computação na Educação Básica – Complemento à BNCC",
        "orgao": "Ministério da Educação — Conselho Nacional de Educação (CNE/CEB)",
        "url": "https://www.gov.br/mec/pt-br/cne/pdf/resolucoes-do-cne/ceb/2022/rceb001_22.pdf",
        "sha256": "4a4312a44ce3248f73770d97bd884f4f6e38abd2a8f3974060cbedd90f2cb7ab",
        "tamanho_bytes": 56349,
        "total_paginas_pdf": 1,
        "mime": "application/pdf",
        "http": {"status": 200, "redirecionamentos": 0, "url_final": "https://www.gov.br/mec/pt-br/cne/pdf/resolucoes-do-cne/ceb/2022/rceb001_22.pdf"},
        "acessado_em": "2026-10-28T11:35:46Z",
        "papel": "fundamento_normativo",
    },
}

PAGINAS_OFICIAIS_DE_LISTAGEM = [
    "https://www.gov.br/mec/pt-br/cne/normas-classificadas-por-assunto/base-nacional-comum-curricular-bncc",
    "https://www.gov.br/mec/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/cne/base-nacional-comum-curricular-bncc",
    "https://www.gov.br/mec/pt-br/cne/parecer-ceb-2022",
]

FONTES_INDISPONIVEIS = [
    {
        "url": "https://portal.mec.gov.br/docman/fevereiro-2022-pdf/235511-pceb002-22/file",
        "motivo": "O host portal.mec.gov.br não possui registros DNS (A, AAAA nem CNAME; resposta SOA/NODATA, confirmada no resolvedor local, em 8.8.8.8 e em 1.1.1.1). As páginas oficiais do gov.br ainda listam este endereço, mas ele não responde.",
        "equivalente_oficial": DOCUMENTOS["parecer"]["url"],
        "verificado_em": "2026-10-28",
    },
    {
        "url": "https://portal.mec.gov.br/docman/outubro-2022-pdf/241671-rceb001-22/file",
        "motivo": "Mesmo host portal.mec.gov.br sem registros DNS.",
        "equivalente_oficial": DOCUMENTOS["resolucao"]["url"],
        "verificado_em": "2026-10-28",
    },
    {
        "url": "http://portal.mec.gov.br/index.php?option=com_docman&view=download&alias=236791-anexo-ao-parecer-cneceb-n-2-2022-bncc-computacao&category_slug=fevereiro-2022-pdf&Itemid=30192",
        "motivo": "Link do Anexo listado na página oficial do MEC no gov.br; mesmo host portal.mec.gov.br sem registros DNS.",
        "equivalente_oficial": DOCUMENTOS["anexo"]["url"],
        "verificado_em": "2026-10-28",
    },
    {
        "url": "https://www.gov.br/mec/pt-br/escolas-conectadas/BNCCComputaoCompletodiagramado.pdf",
        "motivo": "HTTP 404 (corpo JSON com error_type NotFound) em www.gov.br. O documento diagramado da BNCC Computação continua publicado em outro endereço oficial do gov.br e é byte a byte idêntico ao Anexo (mesmo SHA-256).",
        "equivalente_oficial": DOCUMENTOS["anexo_equivalente_gov_br_media"]["url"],
        "verificado_em": "2026-10-28",
    },
    {
        "url": "https://portal.mec.gov.br/docman/janeiro-2022-pdf/233371-documentos-consolidados-comp-bncc-xlsx/file",
        "motivo": "Planilha consolidada oficial inacessível: mesmo host portal.mec.gov.br sem registros DNS. Nenhum equivalente oficial foi localizado em outro endereço; nenhuma cópia de terceiros foi usada. A validação cruzada contra a planilha NÃO foi feita.",
        "equivalente_oficial": None,
        "verificado_em": "2026-10-28",
    },
]

EIXO_TITULO = {"PENSAMENTO COMPUTACIONAL": "Pensamento Computacional", "MUNDO DIGITAL": "Mundo Digital", "CULTURA DIGITAL": "Cultura Digital"}
ORDINAL = {i: f"{i}º ano" for i in range(1, 10)}
EM_COMPETENCIAS_COM_TEXTO_DIVERGENTE = {4, 5, 7}
RELACAO = re.compile(r"^Possui relação direta com \((E[IFM]\d{2}[A-Z]{3}\d{3})\)\.$")

NOTAS = {
    "EF05CO06": "A explicação e o exemplo impressos na mesma linha da tabela descrevem sistema operacional (assunto da habilidade EF05CO07), e não armazenamento de dados. A associação posicional impressa foi preservada exatamente como está no documento; uma possível inversão editorial no Anexo não foi corrigida por inferência.",
    "EF05CO07": "A explicação e o exemplo impressos na mesma linha da tabela descrevem armazenamento de dados (assunto da habilidade EF05CO06), e não sistema operacional. A associação posicional impressa foi preservada exatamente como está no documento; uma possível inversão editorial no Anexo não foi corrigida por inferência.",
    "EF69CO01": "O texto impresso na coluna EXPLICAÇÃO DA HABILIDADE é idêntico, palavra por palavra, ao da coluna EXEMPLOS nesta linha do Anexo; ambos foram preservados como impressos.",
}

CORRECOES = [
    {
        "id": "C1",
        "natureza": "codigo_com_digito_a_mais",
        "campo": "codigo",
        "registros": ["EF05CO11"],
        "pagina_fonte": 36,
        "impresso_na_fonte": "EF05CO011",
        "corrigido": "EF05CO11",
        "justificativa": "O 11º código do 5º ano é impresso como (EF05CO011), com três dígitos. Todos os outros 140 códigos do Anexo têm exatamente 2 dígitos após CO, e a sequência impressa do 5º ano é EF05CO01…EF05CO10 seguida desta linha — a leitura EF05CO11 é a única compatível com o padrão e com a sequência. O código impresso literal fica registrado aqui.",
        "conferido_visualmente": True,
    },
    {
        "id": "C2",
        "natureza": "palavra_quebrada_sem_hifen_no_fim_da_linha",
        "campo": "objeto_conhecimento",
        "registros": ["EF09CO06", "EF09CO07", "EF09CO08", "EF09CO09"],
        "pagina_fonte": 58,
        "impresso_na_fonte": "Segurança e responsabilidad / e no uso da tecnologia",
        "corrigido": "Segurança e responsabilidade no uso da tecnologia",
        "justificativa": "Na célula mesclada do objeto de conhecimento, a palavra 'responsabilidade' é quebrada sem hífen ('responsabilidad' no fim de uma linha e 'e' no início da seguinte). O 'e' inicial da linha seguinte é a última letra da palavra, não uma conjunção: o mesmo objeto é impresso como 'Segurança e responsabilidade no uso da tecnologia' em todas as outras páginas. A correção junta a letra à palavra, sem alterar nenhuma outra.",
        "conferido_visualmente": True,
    },
    {
        "id": "C3",
        "natureza": "marcador_de_continuacao_de_tabela",
        "campo": "objeto_conhecimento / objeto_conhecimento_nivel_2 / enunciado_agrupador",
        "registros": ["EF09CO05"],
        "pagina_fonte": 58,
        "impresso_na_fonte": "Sistemas distribuídos e internet (cont.) / Segurança cibernética (cont.) / Entender os fundamentos de sistemas distribuídos e da internet. (cont.)",
        "corrigido": "Sistemas distribuídos e internet / Segurança cibernética / Entender os fundamentos de sistemas distribuídos e da internet.",
        "justificativa": "A tabela do 9º ano continua na página seguinte e repete as três células mescladas da linha anterior (EF09CO04, p. 56) acrescidas de '(cont.)'. O marcador de continuação não faz parte do texto das células; o texto restante é idêntico ao de EF09CO04.",
        "conferido_visualmente": True,
    },
]


def segmento_e_ano(codigo):
    m = re.fullmatch(r"EF(\d)(\d)CO\d{2}", codigo)
    if not m:
        return None
    a, b = int(m.group(1)), int(m.group(2))
    if (a, b) == (1, 5):
        return ("Anos Iniciais", None, "1º ao 5º ano", [ORDINAL[i] for i in range(1, 6)])
    if (a, b) == (6, 9):
        return ("Anos Finais", None, "6º ao 9º ano", [ORDINAL[i] for i in range(6, 10)])
    ano = int(f"{a}{b}")
    return ("Anos Iniciais" if ano <= 5 else "Anos Finais", ORDINAL[ano], None, [ORDINAL[ano]])


def sem_marcador_cont(valor):
    return re.sub(r"\s*\(cont\.\)\s*$", "", valor) if valor else valor


def montar_registro(r, etapa, hab_tipo):
    codigo = r["codigo_impresso"]
    if codigo == "EF05CO011":
        codigo = "EF05CO11"
    seg = ano = bloco = anos = None
    if etapa == "Ensino Fundamental":
        seg, ano, bloco, anos = segmento_e_ano(codigo)
        titulo = r["quadro"].upper()
        if ano is not None and f"{ano[0]}º ANO" not in titulo:
            raise ValueError(f"{codigo}: ano do código ({ano}) diverge do quadro {r['quadro']!r}")
        if bloco is not None and bloco.upper() not in titulo:
            raise ValueError(f"{codigo}: bloco do código ({bloco}) diverge do quadro {r['quadro']!r}")
    eixo = EIXO_TITULO[r["eixo_impresso"]] if r.get("eixo_impresso") else None
    obj1, obj2, enun = r["objeto_conhecimento"], r["objeto_conhecimento_nivel_2"], r["enunciado_agrupador"]
    if codigo == "EF09CO05":
        obj1, obj2, enun = sem_marcador_cont(obj1), sem_marcador_cont(obj2), sem_marcador_cont(enun)
    if r["pagina_fonte"] == 58 and obj1 == "Segurança e responsabilidad e no uso da tecnologia":
        obj1 = "Segurança e responsabilidade no uso da tecnologia"
    exemplos = list(r["exemplos"])
    relacoes = []
    if exemplos:
        primeira, _, resto = exemplos[0].partition("\n")
        m = RELACAO.match(primeira)
        if m:
            relacoes.append({"codigo": m.group(1), "natureza": "relacao_direta_indicada_pela_fonte", "trecho_na_fonte": primeira, "campo_na_fonte": "EXEMPLOS"})
            exemplos[0] = resto
            if not resto.strip():
                exemplos = exemplos[1:]
    explicacao = "\n\n".join(r["explicacao_blocos"]) if r["explicacao_blocos"] else None
    return {
        "tipo": hab_tipo,
        "codigo": codigo,
        "etapa": etapa,
        "segmento": seg,
        "ano": ano,
        "anos_aplicaveis": anos,
        "bloco_anos": bloco,
        "eixo": eixo,
        "competencia_especifica": None,
        "objeto_conhecimento": obj1,
        "objeto_conhecimento_nivel_2": obj2,
        "enunciado_agrupador": enun,
        "texto": r["texto"],
        "explicacao": explicacao,
        "exemplos": exemplos,
        "relacoes_transversais": relacoes,
        "notas_documentais": [NOTAS[codigo]] if codigo in NOTAS else [],
        "quadro_fonte": r["quadro"],
        "pagina_fonte": r["pagina_fonte"],
        "pagina_impressa": r["pagina_impressa"],
        "pagina_fonte_complemento": r["pagina_fonte_complemento"],
        "pagina_impressa_complemento": r["pagina_impressa_complemento"],
    }


def base_da_fonte(escopo, etapa_nome, segmento):
    return {
        "schema": "bncc-computacao-fonte/1",
        "escopo": escopo,
        "nome_oficial": NOME_OFICIAL,
        "nome_curto": NOME_CURTO,
        "etapa": etapa_nome,
        "segmento": segmento,
        "classificacao": "dado_oficial",
        "natureza_do_conteudo": "Complemento nacional à BNCC (Resolução CNE/CEB nº 1/2022). Não é currículo estadual ou municipal, não é matriz do SAEB e não substitui nenhuma habilidade da BNCC já publicada.",
        "fundamento_normativo": {
            "resolucao": {
                "documento": DOCUMENTOS["resolucao"]["id"],
                "titulo": "Resolução CNE/CEB nº 1, de 4 de outubro de 2022",
                "ementa": "Normas sobre Computação na Educação Básica – Complemento à BNCC.",
                "publicacao": "Diário Oficial da União, Brasília, 6 de outubro de 2022, Seção 1, p. 33.",
                "vigencia": "1º de novembro de 2022 (art. 6º)",
                "dispositivo_sobre_as_tabelas": "Art. 1º, § 2º: o desenvolvimento e a formulação dos currículos devem considerar as tabelas de competências e habilidades anexas.",
                "pagina_pdf": 1,
            },
            "parecer": {
                "documento": DOCUMENTOS["parecer"]["id"],
                "titulo": "Parecer CNE/CEB nº 2/2022",
                "processo": "23001.001050/2019-18",
                "aprovado_em": "2022-02-17",
                "homologacao": "Despacho do Ministro de Estado da Educação, publicado no D.O.U. de 3/10/2022, Seção 1, p. 55.",
                "anexos": "Voto da Comissão: aprovação 'na forma deste Parecer, do Projeto de Resolução e dos anexos (documento SEI 3247470), dos quais são parte integrante' (Parecer, seção II).",
            },
        },
        "fontes": [DOCUMENTOS["anexo"], DOCUMENTOS["anexo_equivalente_gov_br_media"], DOCUMENTOS["parecer"], DOCUMENTOS["resolucao"]],
        "paginas_oficiais_de_listagem": PAGINAS_OFICIAIS_DE_LISTAGEM,
        "fontes_indisponiveis": FONTES_INDISPONIVEIS,
        "validacao_cruzada": {
            "planilha_consolidada_oficial": "nao_realizada — fonte inacessível (ver fontes_indisponiveis)",
            "pdf_diagramado": "byte a byte idêntico ao Anexo (mesmo SHA-256) — não é uma segunda fonte independente",
            "observacao": "A única fonte das tabelas de habilidades acessível é o próprio Anexo; nenhuma cópia de terceiros foi consultada como fonte de dados.",
        },
        "metodo": {
            "extracao": "PyMuPDF (get_text('dict') e get_drawings()). Cada tabela do Anexo é uma tabela larga cortada em duas páginas espelhadas; as linhas horizontais da grade e as colunas lidas das linhas verticais definem as células. Cada faixa de linha é exigida a conter exatamente um código de habilidade.",
            "conferencia_visual": "Todas as páginas com tabela foram renderizadas e lidas contra o texto extraído (código, habilidade, eixo, objeto, explicação, exemplos); ver data/bncc/README.md.",
            "extrator": "scripts/bncc-computacao/extrair_anexo.py",
        },
        "correcoes_tipograficas": [],
        "marcadores_de_continuacao_removidos": [],
        "divergencias_documentais": [],
        "juncoes_de_linha": [],
        "competencias": [],
        "premissas": [],
        "registros": [],
    }


def montar_fontes(bruto, comp_ef, comp_em, premissas_ei, juncoes, intro_premissas):
    saidas = {}

    ei = base_da_fonte("educacao-infantil", "Educação Infantil", None)
    ei["premissas_introducao"] = {"texto": intro_premissas, "quadro_fonte": "PREMISSAS", "pagina_fonte": 5, "pagina_impressa": 1}
    for p in premissas_ei:
        ei["premissas"].append({"tipo": "premissa", "numero": p["numero"], "etapa": "Educação Infantil", "texto": p["texto"], "quadro_fonte": "PREMISSAS", "pagina_fonte": 5, "pagina_impressa": 1})
    ei["registros"] = [montar_registro(r, "Educação Infantil", "objetivo_aprendizagem") for r in bruto["ei"]]
    saidas["educacao-infantil"] = ei

    ef_regs = [montar_registro(r, "Ensino Fundamental", "habilidade") for r in bruto["ef"]]
    for escopo, seg in (("anos-iniciais", "Anos Iniciais"), ("anos-finais", "Anos Finais")):
        f = base_da_fonte(escopo, "Ensino Fundamental", seg)
        for c in comp_ef:
            f["competencias"].append(
                {
                    "tipo": "competencia_especifica",
                    "numero": c["numero"],
                    "etapa": "Ensino Fundamental",
                    "abrangencia": "Ensino Fundamental inteiro (1º ao 9º ano) — a mesma lista de 7 competências aparece nos catálogos dos Anos Iniciais e dos Anos Finais",
                    "texto": c["texto"],
                    "quadro_fonte": "COMPETÊNCIAS",
                    "pagina_fonte": 15,
                    "pagina_impressa": 11,
                }
            )
        f["registros"] = [r for r in ef_regs if r["segmento"] == seg]
        saidas[escopo] = f

    em = base_da_fonte("ensino-medio", "Ensino Médio", None)
    lista = {c["numero"]: c["texto"] for c in comp_em}
    grupos = []
    for r in bruto["em"]:
        if not grupos or grupos[-1]["texto"] != r["competencia_texto"]:
            grupos.append({"texto": r["competencia_texto"], "pagina": r["pagina_fonte"], "impressa": r["pagina_impressa"]})
    if len(grupos) != 7:
        raise ValueError(f"Ensino Médio: esperados 7 grupos de competência nos quadros, achei {len(grupos)}")
    for i, g in enumerate(grupos, 1):
        igual = g["texto"] == lista[i]
        if igual == (i in EM_COMPETENCIAS_COM_TEXTO_DIVERGENTE):
            raise ValueError(f"competência {i}: igualdade entre lista e quadro ({igual}) contradiz as divergências esperadas {sorted(EM_COMPETENCIAS_COM_TEXTO_DIVERGENTE)}")
        em["competencias"].append(
            {
                "tipo": "competencia_especifica",
                "numero": i,
                "etapa": "Ensino Médio",
                "texto": lista[i],
                "texto_no_quadro_de_habilidades": g["texto"],
                "textos_divergem": not igual,
                "quadro_fonte": "COMPETÊNCIAS",
                "pagina_fonte": 65,
                "pagina_impressa": 61,
                "pagina_fonte_quadro": g["pagina"],
                "pagina_impressa_quadro": g["impressa"],
            }
        )
        if not igual:
            em["divergencias_documentais"].append(
                {
                    "id": f"D-EM-COMP-{i}",
                    "natureza": "texto_da_competencia_diverge_entre_lista_e_quadro",
                    "descricao": f"O texto da competência específica {i} impresso na lista de competências (p. 65) difere do texto repetido na primeira coluna do quadro de habilidades (p. {g['pagina']}). Ambos foram preservados.",
                    "texto_na_lista": lista[i],
                    "texto_no_quadro": g["texto"],
                }
            )
    grupo_atual, ultimo = 0, None
    for r in bruto["em"]:
        if r["competencia_texto"] != ultimo:
            grupo_atual += 1
            ultimo = r["competencia_texto"]
        reg = montar_registro(r, "Ensino Médio", "habilidade")
        reg["competencia_especifica"] = grupo_atual
        em["registros"].append(reg)
    saidas["ensino-medio"] = em

    for escopo, f in saidas.items():
        codigos = {r["codigo"] for r in f["registros"]}
        for c in CORRECOES:
            if set(c["registros"]) & codigos:
                (f["marcadores_de_continuacao_removidos"] if c["natureza"] == "marcador_de_continuacao_de_tabela" else f["correcoes_tipograficas"]).append(c)
        paginas = {x["pagina_fonte"] for x in f["registros"]} | {x["pagina_fonte_complemento"] for x in f["registros"]}
        f["juncoes_de_linha"] = [j for j in juncoes if int(re.match(r"p(\d+)", j["contexto"]).group(1)) in paginas]
    return saidas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True, help="Anexo ao Parecer CNE/CEB nº 2/2022 (PDF oficial)")
    ap.add_argument("--saida", required=True, help="diretório onde gravar os 4 arquivos-fonte")
    ap.add_argument("--parecer", help="PDF do Parecer (só para conferir o SHA-256 registrado)")
    ap.add_argument("--resolucao", help="PDF da Resolução (só para conferir o SHA-256 registrado)")
    ap.add_argument("--bruto", help="grava também o JSON bruto de revisão neste caminho")
    args = ap.parse_args()

    pdf = Path(args.pdf)
    if hash_arquivo(pdf) != ANEXO_SHA256:
        raise SystemExit(f"SHA-256 do PDF não confere com o Anexo oficial registrado ({ANEXO_SHA256})")
    for arg, chave in ((args.parecer, "parecer"), (args.resolucao, "resolucao")):
        if arg and hash_arquivo(arg) != DOCUMENTOS[chave]["sha256"]:
            raise SystemExit(f"SHA-256 de {chave} não confere com o registrado")
    doc = pymupdf.open(pdf)
    if doc.page_count != ANEXO_PAGINAS:
        raise SystemExit(f"o Anexo deveria ter {ANEXO_PAGINAS} páginas, tem {doc.page_count}")

    juncoes, avisos = [], []
    bruto = {"ei": [], "ef": [], "em": []}
    for n in PARES_EI:
        bruto["ei"] += extrair_par(doc, n, "ei", juncoes, avisos)
    for n in PARES_EF:
        bruto["ef"] += extrair_par(doc, n, "ef", juncoes, avisos)
    for n in PARES_EM:
        bruto["em"] += extrair_par(doc, n, "em", juncoes, avisos)
    if avisos:
        raise SystemExit("avisos de extração: " + "; ".join(avisos))

    competencias_ef = competencias_numeradas(doc, 15)
    competencias_em = competencias_numeradas(doc, 65)
    premissas_ei = competencias_numeradas(doc, 5)
    intro_premissas = introducao_das_premissas(doc)
    assert intro_premissas.startswith("A Computação permite explorar") and intro_premissas.endswith("premissas."), intro_premissas
    assert [c["numero"] for c in competencias_ef] == list(range(1, 8)), "competências do EF"
    assert [c["numero"] for c in competencias_em] == list(range(1, 8)), "competências do EM"
    assert [c["numero"] for c in premissas_ei] == list(range(1, 5)), "premissas da EI"

    if args.bruto:
        pacote = {"premissas_introducao": intro_premissas, "bruto": bruto, "competencias_ef": competencias_ef, "competencias_em": competencias_em, "premissas_ei": premissas_ei, "juncoes_hifen": juncoes}
        Path(args.bruto).parent.mkdir(parents=True, exist_ok=True)
        Path(args.bruto).write_text(json.dumps(pacote, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

    saidas = montar_fontes(bruto, competencias_ef, competencias_em, premissas_ei, juncoes, intro_premissas)
    destino = Path(args.saida)
    destino.mkdir(parents=True, exist_ok=True)
    for escopo, conteudo in saidas.items():
        alvo = destino / f"official-mec-bncc-computacao-{escopo}.json"
        alvo.write_text(json.dumps(conteudo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        print(f"{alvo.name}: {len(conteudo['registros'])} registros, {len(conteudo['competencias'])} competências, {len(conteudo['premissas'])} premissas")
    print(f"junções de linha registradas: {len(juncoes)}")


if __name__ == "__main__":
    sys.exit(main())
