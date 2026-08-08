# Base local da BNCC

Escopo importado até agora: Competências Gerais da Educação Básica (10/10) e Ensino
Fundamental — Anos Finais — Matemática (6º ao 9º ano). Os demais escopos (Educação
Infantil, demais componentes do Fundamental, Ensino Médio) ainda não foram importados —
ver `README.md` da raiz do projeto / relatório de expansão para o roadmap.

## Proveniência

- Fonte institucional: Base Nacional Comum Curricular, Ministério da Educação.
- Documento: `BNCC_EI_EF_110518_versaofinal_site.pdf`.
- URL oficial: https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf
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

### Matemática — Ensino Fundamental, Anos Finais

O snapshot em `source/official-mec-bncc-matematica-anos-finais.json` é extraído das
páginas de Matemática do PDF oficial. As tabelas são apresentadas em páginas espelhadas:
unidade temática e objeto de conhecimento à esquerda, habilidades à direita. O extrator
(`scripts/bncc/extract_official.py`) associa os registros pelas linhas vetoriais das
próprias tabelas, sem reescrever o texto das habilidades.

O PDF posiciona o expoente da fórmula de `EF08MA09` como glifo elevado. Como a extração
textual do PDF o achata para `ax2`, o pipeline aplica a correção controlada e rastreada
`ax2 → ax²` apenas nessa habilidade e nesses dois campos. O validador também alerta caso
um sobrescrito matemático conhecido volte a ser achatado.

### Competências Gerais da Educação Básica

O snapshot em `source/official-mec-bncc-competencias-gerais.json` é extraído localizando
o cabeçalho "COMPETÊNCIAS GERAIS DA EDUCAÇÃO BÁSICA" no próprio texto do PDF
(`scripts/bncc/extract_competencias_gerais.py`), sem depender de índice de página fixo.
Os dez itens numerados aparecem em duas páginas consecutivas; o extrator lê ambas e
falha se não encontrar exatamente os números 1–10.

A quebra de linha do PDF hifeniza "compreendendo-se" como "com-" / "preendendo-se" no
item 8. A extração bruta juntaria isso como "com- preendendo-se"; o pipeline aplica uma
correção controlada e documentada (mesmo padrão do `ax²` acima) para restaurar a palavra
oficial sem tocar em nenhum outro hífen do texto (inclusive hífens legítimos como
"visual-motora", que não são afetados).

## Atualização

1. Instale `scripts/bncc/requirements.txt` em um ambiente Python.
2. Execute o extrator do escopo desejado (`extract_official.py` ou
   `extract_competencias_gerais.py`) apontando para o PDF oficial.
3. Execute `npm run bncc:import` — processa todos os escopos conhecidos de uma vez,
   grava um dataset e um relatório por escopo, e agrega os totais em
   `data/bncc/import-report.json`. É idempotente: reexecutar sem mudar as fontes produz
   o mesmo resultado (além dos carimbos de data/hora).
4. Revise os relatórios (`data/bncc/<escopo>.report.json` e o agregado) e execute os
   testes.

A ferramenta de planilha oficial do MEC foi investigada e usa `bnccapi.mec.gov.br`,
porém o endpoint segue indisponível (reconfirmado nesta rodada). Quando restabelecido,
ele pode substituir o PDF como entrada estruturada, mantendo as mesmas validações e o
mesmo modelo de saída.
