# Base local da BNCC

Escopo importado até agora: **Competências Gerais da Educação Básica** (10/10),
**Ensino Fundamental — Anos Finais (6º ao 9º ano)** — todos os 9 componentes
curriculares — e **Matemática — Anos Iniciais (1º ao 5º ano)**. Total: 865
registros. Ver `data/bncc/import-report.json` para os totais agregados por
etapa/tipo/componente (gerado a cada `npm run bncc:import`).

| Componente | Habilidades | Snapshot bruto | Dataset final |
| --- | --- | --- | --- |
| Matemática — Anos Finais (6º-9º) | 121 | `source/official-mec-bncc-matematica-anos-finais.json` | `matematica-anos-finais.json` |
| Matemática — Anos Iniciais (1º-5º) | 126 | `source/official-mec-bncc-matematica-anos-iniciais.json` | `matematica-anos-iniciais.json` |
| Língua Portuguesa | 185 | `source/official-mec-bncc-lingua-portuguesa-anos-finais.json` | `lingua-portuguesa-anos-finais.json` |
| Arte | 35 | `source/official-mec-bncc-arte-anos-finais.json` | `arte-anos-finais.json` |
| Educação Física | 42 | `source/official-mec-bncc-educacao-fisica-anos-finais.json` | `educacao-fisica-anos-finais.json` |
| Língua Inglesa | 88 | `source/official-mec-bncc-lingua-inglesa-anos-finais.json` | `lingua-inglesa-anos-finais.json` |
| Ciências | 63 | `source/official-mec-bncc-ciencias-anos-finais.json` | `ciencias-anos-finais.json` |
| Geografia | 67 | `source/official-mec-bncc-geografia-anos-finais.json` | `geografia-anos-finais.json` |
| História | 98 | `source/official-mec-bncc-historia-anos-finais.json` | `historia-anos-finais.json` |
| Ensino Religioso | 30 | `source/official-mec-bncc-ensino-religioso-anos-finais.json` | `ensino-religioso-anos-finais.json` |
| Competências Gerais | 10 | `source/official-mec-bncc-competencias-gerais.json` | `competencias-gerais.json` |

Na aplicação (`lib/bncc/data.ts`), as duas linhas de Matemática são mescladas num
único `bnccSkills` — pro usuário é um componente só, cobrindo 1º ao 9º ano.

**Ainda não importado** (roadmap): Anos Iniciais (1º ao 5º ano) dos outros 8
componentes, Educação Infantil, Ensino Médio — ver `README.md` da raiz do projeto.

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
- `extract_lingua_portuguesa.py` — Língua Portuguesa. Estrutura própria de 3 níveis
  (Campo de atuação → Prática de linguagem → Objeto de conhecimento); usa
  `table_boundaries(..., min_count=1)` porque algumas páginas (ex.: introdução do
  Campo Artístico-Literário) têm só 1 linha de tabela real.
- `extract_arte.py`, `extract_educacao_fisica.py`, `extract_lingua_inglesa.py` —
  layouts próprios (Arte tem um único código `EF69AR##` consolidado para 6º-9º;
  Educação Física e Língua Inglesa têm códigos pareados por dupla de anos, ex.
  `EF67EF01`).
- `extract_grade_component.py` — script genérico e parametrizado (via
  `--start-heading`, `--end-marker`, `--code-prefix`, `--area`, `--componente`) usado
  para Ciências, Geografia, História e Ensino Religioso, que compartilham o mesmo
  layout de tabela (unidade temática/objeto à esquerda, ano derivado dos dígitos do
  próprio código, não da posição na página — robusto a páginas de "Continuação").
- `extract_competencias_gerais.py` — localiza o cabeçalho "COMPETÊNCIAS GERAIS DA
  EDUCAÇÃO BÁSICA" no próprio texto do PDF (não por índice de página fixo), lê os 10
  itens numerados e falha se não achar exatamente 1–10.
- `bncc_extract_common.py` — módulo compartilhado: `clean_text`,
  `find_heading_page`, `table_boundaries`, `column_text` (filtra texto por posição
  real da linha, evita que texto de uma coluna vizinha vaze pra outra em tabelas
  largas — ver nota abaixo).

### Correções tipográficas controladas conhecidas

- `EF08MA09`: `ax2 → ax²` (expoente achatado pelo PyMuPDF).
- `EF07MA33`: restaura o símbolo `π`, que o PyMuPDF também falha em extrair desse
  glifo específico (bug pré-existente, confirmado direto no PDF bruto).
- Competências Gerais, item 8: `com- preendendo-se → compreendendo-se` (hifenização
  de quebra de linha do PDF; nenhum outro hífen do texto é tocado, inclusive hífens
  legítimos como "visual-motora").

Qualquer nova correção desse tipo deve seguir o mesmo padrão: documentada aqui,
restrita a um código/campo específico, nunca uma substituição ampla ou silenciosa.

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
manualmente e usada para validação cruzada de Língua Portuguesa, Língua Inglesa
(273 registros comparados, correspondência quase perfeita — 2 casos em que esta
extração era mais precisa que a planilha) e Matemática Anos Iniciais (126/126
códigos, texto, objeto e unidade — 100% idêntico, com 2 exceções que são erro de
transcrição da própria planilha, confirmado contra o PDF bruto). A planilha
cobre 1º ao 9º ano de todos os 9 componentes, então também serve de referência
pros Anos Iniciais dos demais componentes quando forem extraídos. Não está
versionada no repositório (`.gitignore`) por não ser necessária para o site
funcionar; quem quiser refazer essa validação precisa da própria planilha.
