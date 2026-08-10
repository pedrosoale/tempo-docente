# Base local da BNCC

Escopo importado até agora: **Competências Gerais da Educação Básica** (10/10),
**Ensino Fundamental — Anos Finais (6º ao 9º ano)** — todos os 9 componentes
curriculares — e **Anos Iniciais (1º ao 5º ano)** de 7 dos 9 componentes
(faltam só Língua Portuguesa e Língua Inglesa — a última não existe nos Anos
Iniciais na própria BNCC). Total: 1107 registros. Ver
`data/bncc/import-report.json` para os totais agregados por etapa/tipo/componente
(gerado a cada `npm run bncc:import`).

| Componente | Anos Iniciais (1º-5º) | Anos Finais (6º-9º) |
| --- | --- | --- |
| Matemática | 126 | 121 |
| Arte | 26 | 35 |
| Educação Física | 27 | 42 |
| Ciências | 48 | 63 |
| Geografia | 56 | 67 |
| História | 52 | 98 |
| Ensino Religioso | 33 | 30 |
| Língua Portuguesa | — (pendente) | 185 |
| Língua Inglesa | não existe na BNCC | 88 |
| Competências Gerais | 10 (toda a Educação Básica, sem ano) | |

Cada célula é `source/official-mec-bncc-<componente>-anos-{iniciais,finais}.json`
→ `<componente>-anos-{iniciais,finais}.json`. Na aplicação (`lib/bncc/data.ts`),
as duas linhas de cada componente são mescladas num único array de skills — pro
usuário é um componente só, cobrindo 1º ao 9º ano (exceto Português, ainda só
6º-9º, e Inglês, que a própria BNCC só tem a partir do 6º ano).

**Ainda não importado** (roadmap): Anos Iniciais de Língua Portuguesa, Educação
Infantil, Ensino Médio — ver `README.md` da raiz do projeto.

## Proveniência

- Fonte institucional: Base Nacional Comum Curricular, Ministério da Educação.
- Documento: `BNCC_EI_EF_110518_versaofinal_site.pdf`.
- URL oficial: <https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf>
- Classificação: `dado_oficial`.

**Atenção ao escopo real deste arquivo.** O nome do arquivo referencia a versão final de
Educação Infantil e Ensino Fundamental (11/05/2018), mas os metadados internos do PDF
(conferidos com `pymupdf`) mostram `creationDate` de 13/12/2018 e `modDate` de
19/12/2018 — dentro da janela de homologação do Ensino Médio (dez/2018). O arquivo
hoje hospedado nessa URL é o **documento consolidado final** (Educação Infantil +
Ensino Fundamental + Ensino Médio, 600 páginas), não um arquivo restrito a EI/EF. Ele já
contém, por exemplo, o capítulo do Ensino Médio (a partir da página impressa ~469) e
habilidades no padrão `EM13...`. Nada disso foi importado ainda — só é registrado aqui
para quem for extrair o Ensino Médio no futuro: **reutilize este mesmo PDF**, não é
necessário procurar um arquivo separado.

## Extratores por componente (`scripts/bncc/`)

Cada componente tem seu próprio script de extração porque o PDF oficial organiza
cada um em um layout de tabela ligeiramente diferente — a extração usa as próprias
linhas vetoriais das tabelas (`page.get_drawings()`) para achar os limites de cada
linha/registro, nunca regex sobre o texto corrido. Nenhum extrator reescreve o texto
oficial da habilidade; o único tratamento aplicado é a correção tipográfica
controlada e documentada abaixo (glifos que o PyMuPDF falha em extrair, como `π` ou
expoentes), sempre restrita a um código e campo específicos.

- `extract_official.py` — Matemática, Anos Finais (também tem as correções `ax²`
  e `π` de exemplo).
- `extract_matematica_anos_iniciais.py` — Matemática, Anos Iniciais (1º-5º ano).
  Mesma técnica de página espelhada de `extract_official.py`, mapa de páginas
  próprio (0-based 279-298 no PDF).
- `extract_lingua_portuguesa.py` — Língua Portuguesa (Anos Finais). Estrutura
  própria de 3 níveis (Campo de atuação → Prática de linguagem → Objeto de
  conhecimento); usa `table_boundaries(..., min_count=1)` porque algumas páginas
  (ex.: introdução do Campo Artístico-Literário) têm só 1 linha de tabela real.
- `extract_arte.py` — Arte, Anos Iniciais e Finais. `--start-heading`/
  `--end-marker`/`--code-regex`/`--ano-label`/`--anos-aplicaveis`/`--segmento`/
  `--col-split` são parametrizados via CLI; os defaults reproduzem exatamente o
  comportamento original (Anos Finais, código único `EF69AR##`). Anos Iniciais
  usa `EF15AR##` e um `--col-split` diferente (ver nota abaixo).
- `extract_educacao_fisica.py` — Educação Física, Anos Iniciais e Finais. Duas
  subseções pareadas por CLI (`--heading1`/`--grade-key1`/... e `--heading2`/...):
  Anos Finais é `EF67EF`/`EF89EF`, Anos Iniciais é `EF12EF`/`EF35EF`.
- `extract_lingua_inglesa.py` — Língua Inglesa. Só Anos Finais — a BNCC não tem
  Língua Inglesa nos Anos Iniciais.
- `extract_grade_component.py` — script genérico e parametrizado (via
  `--start-heading`, `--end-marker`, `--code-prefix`, `--grade-digits`,
  `--segmento`, `--area`, `--componente`) usado para Ciências, Geografia,
  História e Ensino Religioso — Anos Iniciais e Finais —, que compartilham o
  mesmo layout de tabela (unidade temática/objeto à esquerda, ano derivado dos
  dígitos do próprio código, não da posição na página — robusto a páginas de
  "Continuação"). `--grade-digits` default `"0[6-9]"` (Anos Finais); Anos
  Iniciais passa `"0[1-5]"`.
- `extract_competencias_gerais.py` — localiza o cabeçalho "COMPETÊNCIAS GERAIS DA
  EDUCAÇÃO BÁSICA" no próprio texto do PDF (não por índice de página fixo), lê os 10
  itens numerados e falha se não achar exatamente 1–10.
- `bncc_extract_common.py` — módulo compartilhado: `clean_text`,
  `find_heading_page`, `table_boundaries`, `column_text` (filtra texto por posição
  real da linha, evita que texto de uma coluna vizinha vaze pra outra em tabelas
  largas — ver nota abaixo).

### Localizando seções de Anos Iniciais: cabeçalho não basta

Para todo componente extraído nesta rodada, `find_heading_page()` sozinho (usado
como `--end-marker`) sub- ou superestimou o fim da seção pelo menos uma vez — o
cabeçalho da próxima seção às vezes vem depois de páginas de introdução em prosa
ou de uma página em branco, que não têm tabela nenhuma e derrubam
`table_boundaries()` com um erro claro (bom sinal — falha ruidosa, não dado
errado). O procedimento que funcionou de forma confiável: extrair o texto bruto
de cada página candidata (`page.get_text()`), localizar a última ocorrência real
de um código do último ano (`(EF05XX##)`) e usar a página seguinte como limite —
nunca assumir que o próximo cabeçalho textual marca o fim exato da tabela.

### Correções tipográficas controladas conhecidas

- `EF08MA09`: `ax2 → ax²` (expoente achatado pelo PyMuPDF).
- `EF07MA33`: restaura o símbolo `π`, que o PyMuPDF também falha em extrair desse
  glifo específico (bug pré-existente, confirmado direto no PDF bruto).
- Competências Gerais, item 8: `com- preendendo-se → compreendendo-se` (hifenização
  de quebra de linha do PDF; nenhum outro hífen do texto é tocado, inclusive hífens
  legítimos como "visual-motora").
- `EF04GE08`: `matérias- primas → matérias-primas` (mesmo tipo de hifenização de
  quebra de linha; `matérias-\nprimas` no PDF bruto, confirmado contra a planilha
  oficial).

Qualquer nova correção desse tipo deve seguir o mesmo padrão: documentada aqui,
restrita a um código/campo específico, nunca uma substituição ampla ou silenciosa.

### Divergências confirmadas como erro da planilha, não da extração

Encontradas durante a validação cruzada dos Anos Iniciais — mantidas como estão
na extração porque o PDF bruto confirma nossa versão:

- **EF02MA06/EF03MA05** (Matemática): a planilha tem "ou convencionais" a mais
  num e "inclusive os convencionais," a menos no outro; o PDF bate com nossa
  extração nos dois casos.
- **EF03GE08** (Geografia): planilha tem um espaço espúrio em
  "reciclagem/ descarte"; PDF não tem esse espaço.
- **EF15AR13/EF15AR24** (Arte): o próprio PDF oficial é inconsistente entre
  ocorrências repetidas do mesmo rótulo — "Contextos e práticas" na seção de
  Artes Visuais/Dança, mas "Contexto e práticas" (singular) na de Música; mesma
  coisa com "Matrizes estéticas e culturais" vs "Matrizes estéticas culturais"
  entre Artes Visuais e Artes Integradas. A planilha aparentemente normalizou
  essas ocorrências; nossa extração preserva o texto verbatim de cada uma,
  conforme a regra do projeto de nunca reescrever o texto oficial.

### Layout de coluna não é sempre o mesmo (Arte, Anos Iniciais)

Toda tabela do documento, de Matemática a Ensino Religioso, divide as colunas
"Unidades Temáticas" e "Objetos de Conhecimento" na mesma posição horizontal
(x≈291,5-292). A tabela de Arte — Anos Iniciais é a única exceção confirmada:
sua divisória real (linha vetorial do próprio PDF) fica em x≈212. Usar o divisor
padrão ali cortava as duas colunas no lugar errado, produzindo objetos truncados
("ráticas" em vez de "Contextos e práticas") e unidades com lixo concatenado.
`extract_arte.py` agora recebe o divisor via `--col-split`, sempre confirmado
inspecionando as linhas vetoriais da página (`page.get_drawings()`) antes de
extrair — nunca assumido pela posição de outras tabelas do mesmo documento.

### Bug de fusão de linha corrigido (afetou dado já publicado)

Todo extrator baseado em tabela estende o último limite de linha detectado
(`table_boundaries()`) até o rodapé real da página, porque a borda inferior da
tabela nem sempre é uma linha vetorial de largura total. A correção original
fazia isso por **substituição**: `boundaries[-1] = max(boundaries[-1], borda)`.
O problema: quando `boundaries[-1]` já era uma divisória real entre as duas
últimas linhas da tabela (não a borda de fechamento ausente), substituí-la
**apaga essa divisória** e funde o texto de unidade/objeto das duas últimas
linhas, aplicando o valor fundido a todos os códigos de ambas.

Descoberto construindo o extrator de Matemática Anos Iniciais (EF04MA27 e
EF04MA28 saíram com o mesmo `objeto_conhecimento` concatenado). Auditado em
todos os extratores que usavam o mesmo padrão, reexecutando cada um contra o
PDF oficial e comparando com o dado publicado: Matemática, Arte, Educação
Física, Língua Inglesa e o extrator genérico (Ciências/Geografia/História/
Ensino Religioso) vieram idênticos — só **Língua Portuguesa tinha corrupção
real em produção**, 11 códigos (EF06LP03-06, EF07LP03-07, EF67LP34-35) com dois
valores de `objeto_conhecimento` diferentes grudados. Confirmado contra a
planilha oficial para os 11 e corrigido.

Correção aplicada nos seis extratores: **adicionar** uma borda sintética de
fechamento em vez de sobrescrever a última borda detectada — só estende a
tabela quando não há conteúdo real logo depois, nunca apaga uma divisória.

### Bug de contaminação corrigido (Língua Portuguesa)

A extração original usava `page.get_textbox(rect)`, que recorta por **sobreposição**
de caractere/span com o retângulo — em tabelas largas isso vaza texto de uma coluna
vizinha quando a linha de origem passa perto da borda do retângulo. Isso produzia
valores de `objeto_conhecimento` de 900+ caracteres, contaminados com o parágrafo de
introdução do Campo Artístico-Literário, para os códigos EF69LP44/45/46. Corrigido
com o helper `column_text()` (em `bncc_extract_common.py`), que filtra por posição
`x0` real de cada linha via `get_text('dict')` em vez de recorte por sobreposição.

## Atualização

1. Instale `scripts/bncc/requirements.txt` em um ambiente Python.
2. Execute o(s) extrator(es) do(s) escopo(s) desejado(s), apontando para o PDF
   oficial (todos usam a mesma URL/documento, ver acima).
3. Execute `npm run bncc:import` — processa todos os escopos conhecidos de uma vez,
   grava um dataset e um relatório por escopo, e agrega os totais em
   `data/bncc/import-report.json`. É idempotente: reexecutar sem mudar as fontes produz
   o mesmo resultado (além dos carimbos de data/hora).
4. Revise os relatórios (`data/bncc/<escopo>.report.json` e o agregado) e execute
   `npm run bncc:validate` (ou a suíte completa com `npm test`).

A ferramenta de planilha oficial do MEC foi investigada e usa `bnccapi.mec.gov.br`,
porém o endpoint segue indisponível (reconfirmado nesta rodada). Quando restabelecido,
ele pode substituir o PDF como entrada estruturada, mantendo as mesmas validações e o
mesmo modelo de saída.

Uma planilha oficial do MEC (Excel, 1º ao 9º ano, sem Ensino Médio) foi fornecida
manualmente e usada para validação cruzada de todos os escopos de Anos Iniciais
extraídos até agora — código por código, texto por texto, objeto por objeto,
unidade por unidade:

| Escopo | Códigos | Divergências reais |
| --- | --- | --- |
| Matemática (1º-5º) | 126/126 | 0 (2 erros da planilha) |
| Ciências (1º-5º) | 48/48 | 0 |
| Geografia (1º-5º) | 56/56 | 0 (1 erro da planilha) |
| História (1º-5º) | 52/52 | 0 |
| Ensino Religioso (1º-5º) | 33/33 | 0 |
| Arte (1º-5º) | 26/26 | 0 (2 inconsistências do próprio PDF) |
| Educação Física (1º-5º) | 27/27 | 0 |
| Língua Portuguesa/Inglesa (6º-9º, validação anterior) | 273 | 0 (2 casos em que a extração era mais precisa) |

A planilha cobre 1º ao 9º ano de todos os 9 componentes, então também serve de
referência pra Língua Portuguesa — Anos Iniciais quando for extraída. Não está
versionada no repositório (`.gitignore`) por não ser necessária para o site
funcionar; quem quiser refazer essa validação precisa da própria planilha.
