# Base local da BNCC

Escopo importado até agora: **Competências Gerais da Educação Básica** (10/10),
**Ensino Fundamental — Anos Finais (6º ao 9º ano)** — todos os 9 componentes
curriculares —, **Anos Iniciais (1º ao 5º ano)** de 8 dos 9 componentes (falta
só Língua Inglesa, que não existe nos Anos Iniciais na própria BNCC — não é uma
lacuna a preencher) —, e **Ensino Médio — Formação Geral Básica**, completo: as
4 áreas do conhecimento e Língua Portuguesa. Total: 1517 registros. Ver
`data/bncc/import-report.json` para os totais agregados por etapa/tipo/componente
(gerado a cada `npm run bncc:import`).

| Componente | Anos Iniciais (1º-5º) | Anos Finais (6º-9º) |
| --- | --- | --- |
| Matemática | 126 | 121 |
| Língua Portuguesa | 206 | 185 |
| Arte | 26 | 35 |
| Educação Física | 27 | 42 |
| Ciências | 48 | 63 |
| Geografia | 56 | 67 |
| História | 52 | 98 |
| Ensino Religioso | 33 | 30 |
| Língua Inglesa | não existe na BNCC | 88 |
| Competências Gerais | 10 (toda a Educação Básica, sem ano) | |

Cada célula é `source/official-mec-bncc-<componente>-anos-{iniciais,finais}.json`
→ `<componente>-anos-{iniciais,finais}.json`. Na aplicação (`lib/bncc/data.ts`),
as duas linhas de cada componente são mescladas num único array de skills — pro
usuário é um componente só, cobrindo 1º ao 9º ano (exceto Inglês, que a própria
BNCC só tem a partir do 6º ano).

| Ensino Médio — escopo | Competências específicas | Habilidades |
| --- | --- | --- |
| Linguagens e suas Tecnologias | 7 | 28 |
| Língua Portuguesa (componente dentro de Linguagens) | reaproveita as 7 de Linguagens (não tem competências próprias) | 54 |
| Matemática e suas Tecnologias | 5 | 43 |
| Ciências da Natureza e suas Tecnologias | 3 | 26 |
| Ciências Humanas e Sociais Aplicadas | 6 | 32 |

21 competências específicas + 183 habilidades = 204 registros. Diferente do
Fundamental, a BNCC do Médio não organiza habilidades por ano/série — o próprio
documento diz que "as habilidades são apresentadas sem indicação de seriação"
(Lei nº 13.415/2017) —, então não há campo `ano`/`anos_aplicaveis` nesses
registros; a organização é por área/componente + competência específica (Língua
Portuguesa foge disso e organiza por campo de atuação social, ver seção própria
abaixo). Ver "Extratores — Ensino Médio" e "Pegadinhas encontradas no Ensino
Médio" mais abaixo para o processo completo.

**Ainda não importado** (roadmap): Educação Infantil, e os Itinerários
Formativos do Ensino Médio — este último não por falta de tempo, mas porque o
documento oficial consolidado (mesmo PDF usado aqui) não codifica habilidades
para os itinerários com um código rastreável como `EM13...`; é orientação em
prosa para que redes/escolas construam seus próprios percursos flexíveis, então
não há o que extrair de forma estruturada sem inventar dado que a fonte não
declara.

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
- `extract_lingua_portuguesa.py` — Língua Portuguesa, Anos Iniciais e Finais
  (`--section-headings`/`--end-marker`/`--segmento`/`--escopo-nota`
  parametrizados via CLI; defaults reproduzem o comportamento original de Anos
  Finais). Estrutura própria de 3 níveis (Campo de atuação → Prática de
  linguagem → Objeto de conhecimento); usa `table_boundaries(..., min_count=1)`
  porque algumas páginas (ex.: introdução do Campo Artístico-Literário) têm só
  1 linha de tabela real. Ver "Campo/prática por parágrafo" abaixo — a parte
  mais delicada de todo este pipeline.
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

## Extratores — Ensino Médio (`scripts/bncc/`)

O capítulo do Ensino Médio, dentro do mesmo PDF consolidado usado para o
Fundamental (ver "Proveniência" acima), tem um layout completamente diferente:
prosa corrida com marcadores de texto (`COMPETÊNCIA ESPECÍFICA N`,
`HABILIDADES`), nunca uma tabela vetorial real — `page.get_drawings()` só acha
réguas decorativas de cabeçalho/rodapé, não uma grade de dados como no
Fundamental. Confirmado lendo o texto completo de cada área antes de escrever
qualquer extrator, porque assumir que a estrutura se repetiria entre áreas já
causou os bugs documentados na seção seguinte.

- `extract_ensino_medio_area.py` — script único, parametrizado via CLI
  (`--area-slug`, `--area`, `--componente`, `--code-prefix`,
  `--num-competencias`, `--concise-heading`, `--end-marker`), usado para as 4
  áreas do conhecimento (Linguagens, Matemática, Ciências da Natureza, Ciências
  Humanas). Localiza a lista curta de competências específicas pelo próprio
  texto do documento, depois a seção detalhada (`COMPETÊNCIA ESPECÍFICA N` +
  bloco `HABILIDADES`), extraindo `(CÓDIGO) texto.` até a competência seguinte
  ou o fim da área.
- `extract_matematica_unidade_tematica.py` — script pequeno e separado só para
  a segunda tabela de Matemática ("Considerações sobre a organização
  curricular"), que **repete os mesmos 43 códigos já extraídos**, reagrupados
  por unidade temática (Números e Álgebra, Geometria e Medidas, Probabilidade e
  Estatística) em vez de por competência. Gera só um mapeamento
  código → unidade_tematica; `import.mjs` usa isso pra enriquecer os registros
  já aceitos, nunca pra criar registros novos — um código no mapeamento sem
  correspondente já aceito (ou vice-versa) é erro de validação.
- `extract_lingua_portuguesa_medio.py` — dedicado, porque Língua Portuguesa
  (componente com peso próprio dentro de Linguagens) não segue o padrão das
  outras 4: organizada por **campo de atuação social** (6 campos), sem
  competências específicas próprias — cada habilidade referencia 1+ das 7
  competências de Linguagens numa coluna própria da tabela oficial. Ver
  "Por que Língua Portuguesa usa casamento atômico" abaixo — a parte mais
  delicada deste pipeline, no mesmo espírito do que já exigiu cuidado extra no
  Fundamental.

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

### Campo/prática por parágrafo, não por retângulo inteiro (Língua Portuguesa)

O maior refinamento desta rodada. `extract_pair()` lia a coluna de
unidade/campo de uma linha inteira como um único bloco de texto
(`get_textbox()`), então testava esse bloco contra `CAMPO_LABELS`. Isso
quebra sempre que uma linha alta (comum quando o limite da tabela é
estendido — ver bug de fusão acima) contém mais de um parágrafo real:

- **Campo + prática empilhados** (confirmado na pág. 119): o parágrafo
  introdutório de um campo termina e, na mesma linha detectada, já começa o
  rótulo de prática seguinte ("Leitura/escuta"). Ler tudo como um bloco só
  fazia o `match_campo()` "engolir" o rótulo — a prática nunca era capturada.
- **Dois cabeçalhos de campo na mesma linha** (confirmado na pág. 171,
  EF06LP03-06): o código antigo, testando o bloco inteiro contra
  `CAMPO_LABELS` (um `dict`, iterado em ordem de inserção), retornava o
  primeiro campo que batesse — por *coincidência* de ordem do dicionário, não
  por posição no texto. Corrigido para usar o primeiro campo por posição real
  (`unit_column_paragraphs()`, que agrupa linhas por espaçamento vertical
  >18pt): os códigos da própria linha usam o primeiro campo encontrado nela; um
  segundo campo na mesma linha só atualiza o estado herdado pelas linhas
  seguintes.
- **Rótulo + nota de rodapé** (confirmado na pág. 143: "Oralidade" seguido de
  "*Considerar todas as habilidades..."): dois parágrafos não-campo seguidos
  precisam ser concatenados, não um substituindo o outro.
- **Prosa do próprio campo sendo confundida com rótulo** (confirmado na pág.
  157, Campo Artístico-Literário: quatro parágrafos de ~200-400 caracteres
  antes do rótulo real "Leitura"): `looks_like_pratica_label()` distingue um
  rótulo real (curto, não começa com hífen de marcador) da prosa introdutória
  do campo, que é descartada em vez de acumulada.

Validado recontando **todos os 185 registros de Anos Finais já publicados**
contra a planilha oficial: a versão antiga acertava `campo_atuacao` em 145/185
(78%); a corrigida acerta 177/185 (96%) — os 8 restantes são um único padrão
ambíguo (transição de campo numa linha sem nenhum código associado, ver
EF89LP24 no relatório de validação) que não foi resolvido e fica documentado
como limitação conhecida. Duas correções tipográficas controladas adicionais
saíram dessa auditoria:

- `"linguística/ semiótica" → "linguística/semiótica"`: espaço espúrio
  presente no próprio *span* do PDF (não é quebra de linha), confirmado em
  múltiplas ocorrências.
- Uma linha terminando em `/` (ex. `"Análise linguística/"` quebrando para
  `"semiótica"`) é rejuntada sem espaço — só para esse caractere específico;
  todo outro fim de linha continua rejuntado com espaço, como antes.

## Pegadinhas encontradas no Ensino Médio

Todas descobertas construindo e validando os extratores contra o PDF real —
nenhuma foi assumida a partir do comportamento de outra área. Servem de
lembrete pra quem for extrair os Itinerários Formativos no futuro (se o
documento oficial vier a codificá-los): não presuma que a estrutura de uma
área/seção se repete nas outras.

### Vazamento de cabeçalho de página no fim de competência

Toda página do capítulo repete um cabeçalho de 3 linhas (número da página +
"BASE NACIONAL / COMUM CURRICULAR" ou "‹ÁREA› / ENSINO MÉDIO", dependendo de
página par/ímpar). Sem removê-lo antes de concatenar o texto, a última
habilidade de uma competência antes de uma virada de página engolia esse
cabeçalho da página seguinte no próprio texto (confirmado:
`EM13LGG105` saiu terminando em "... intervenção social. 492 BASE NACIONAL
COMUM CURRICULAR" antes da correção). `strip_running_header()` remove essas 3
linhas quando a primeira linha da página é só um número; uma checagem
defensiva adicional (`assert_no_running_header_leak`) falha alto se esse
padrão aparecer em qualquer texto aceito, mesmo que o strip por posição falhe
numa página atípica.

### "HABILIDADES" repetido como marcador de continuação (Ciências da Natureza)

Uma lista de habilidades longa pode continuar numa página que **não** tem o
cabeçalho padrão de 3 linhas — em vez disso, a própria página começa
repetindo só a palavra "HABILIDADES" como rótulo de continuação (confirmado
na página que continua a competência 3 de Ciências da Natureza, entre
`EM13CNT307` e `EM13CNT308`). Sem tratar isso, `EM13CNT307` engolia o
"HABILIDADES" da página seguinte no fim do próprio texto. Corrigido
sanitizando toda ocorrência de "HABILIDADES" dentro do texto de uma
competência antes de extrair os códigos (não só a primeira, usada como âncora
de início), preservando os offsets originais pra não afetar a atribuição de
`pagina_fonte`.

### Marcador de fim errado engoliu a introdução da área seguinte (Ciências da Natureza)

Erro real, não hipotético: o primeiro `--end-marker` usado pra Ciências da
Natureza apontava pro cabeçalho da lista curta de competências de Ciências
Humanas — mas esse cabeçalho fica ~10 páginas depois de onde a área de
Ciências da Natureza realmente termina. Como não havia nenhum código
`EM13CNT...` nesse intervalo, `EM13CNT310` (última habilidade da área) saiu
com toda a introdução em prosa de Ciências Humanas grudada no próprio texto —
milhares de caracteres. Corrigido apontando o marcador para o início real da
próxima área ("A ÁREA DE CIÊNCIAS HUMANAS E SOCIAIS APLICADAS"), a página
imediatamente seguinte à última habilidade. Lição: o marcador de fim precisa
ser o **início real** da próxima seção, não qualquer cabeçalho posterior que
pareça razoável.

### Segunda tabela duplicando os mesmos códigos (Matemática)

Depois das 5 competências específicas, o documento repete os mesmos 43
códigos de Matemática inteiros (código + texto idêntico), reagrupados por
unidade temática em vez de competência — confirmado contando: sem o
`--end-marker` certo, a extração ingênua encontrava 86 ocorrências de código
em vez de 43, exatas 2×. Nenhuma das outras 3 áreas simples tem essa segunda
tabela (confirmado por contagem exata sem sobra nas 3). Tratado como escopo
separado (`extract_matematica_unidade_tematica.py`), nunca fundido com a
extração principal.

### Ligadura tipográfica com 3 ocorrências, 2 perdidas na primeira checagem (Ciências Humanas)

O PyMuPDF renderiza o glifo de ligadura `ﬁ` (U+FB01) como token próprio
seguido de espaço espúrio, quebrando palavras. Na primeira varredura só um
exemplo foi conferido ("cientíﬁ cos" → "científicos"), e a correção
controlada cobriu só esse caso. Uma checagem exaustiva por todas as 3
ocorrências reais no capítulo (não só a primeira encontrada) revelou mais
duas na mesma página, palavras diferentes: "cientíﬁ ca" → "científica" e
"Identiﬁ car" → "Identificar". As 3 estão documentadas em
`CONTROLLED_TYPOGRAPHY_CORRECTIONS["ciencias-humanas"]`, restritas às strings
exatas. Lição prática: ao auditar uma correção tipográfica, conferir *todas*
as ocorrências do glifo problemático no escopo, não só a primeira que
apareceu.

### Cabeçalho multilinha com espaço duplo faz `find_heading_page` falhar silenciosamente

Vários cabeçalhos do capítulo quebram linha assim: `"LINGUAGENS E SUAS \nTECNOLOGIAS"` — nota o espaço à direita antes da quebra. O
`find_heading_page()` compartilhado faz só `texto.replace("\n", " ")`, o que
produz `"...SUAS  TECNOLOGIAS"` (espaço duplo) — uma string de busca com
espaço simples nunca bate, e a falha não é um erro claro, é simplesmente "não
achou" silenciosamente até o loop varrer o documento inteiro e estourar
`ValueError` de forma confusa. Os extratores do Ensino Médio usam uma versão
própria (`find_heading_page_normalized`) que primeiro roda o texto por
`clean_text()` (já usado pelo resto do pipeline, colapsa espaços) antes de
comparar — não alterei o helper compartilhado pra não arriscar o
comportamento já validado dos extratores do Fundamental.

### Por que Língua Portuguesa usa casamento atômico, não "captura até o próximo código"

Todo extrator das 4 áreas simples (e da maioria do Fundamental) captura o
texto de uma habilidade como "tudo até o próximo código aparecer". Isso
quebra para Língua Portuguesa: entre a última habilidade de um campo de
atuação e a primeira do campo seguinte, o documento sempre insere a
introdução em prosa do novo campo e uma lista de bullets "Parâmetros para a
organização/progressão curricular" — texto real, sem nenhum código dentro,
que ficaria inteiro grudado na última habilidade do campo anterior (confirmado
entre `EM13LP18` e `EM13LP19`, a transição real de "Todos os Campos de
Atuação Social" pra "Campo da Vida Pessoal").

A correção não foi filtrar esse texto — foi mudar a forma de casar cada
habilidade: como toda habilidade real da tabela tem sua própria linha de
competências específicas (um ou mais dígitos, ex. `"1, 7"`) logo depois do
parágrafo, o regex casa `(CÓDIGO) texto` **junto com** essa linha de dígitos
num único match atômico (`\((EM13LP\d{2})\)\s*(.+?)\n(\d{1,2}(?:,\s*\d{1,2})*)\s*\n`).
O match nunca ultrapassa uma linha de tabela, então cabeçalho de coluna
repetido, introdução de campo e bullets de parâmetros nunca são capturados —
não porque foram removidos, mas porque o casamento nunca chega até eles. O
campo de atuação de cada habilidade é atribuído à parte, carregando adiante o
cabeçalho de campo mais recente (bare heading, sem precisar do bloco de
cabeçalho de coluna inteiro) — validado contra a distribuição oficial
(18/4/5/8/10/9 = 54) antes de confiar no resultado.

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
| Língua Portuguesa (1º-5º) | 206/206 | 0 (8 erros/truncamentos confirmados da planilha) |
| Língua Portuguesa (6º-9º, reauditada nesta rodada) | 185/185 | 0 (13 erros/truncamentos confirmados da planilha) |
| Língua Portuguesa/Inglesa (6º-9º, validação anterior) | 273 | 0 (2 casos em que a extração era mais precisa) |

A planilha cobre 1º ao 9º ano de todos os 9 componentes. Não está versionada no
repositório (`.gitignore`) por não ser necessária para o site funcionar; quem
quiser refazer essa validação precisa da própria planilha.
