# Matriz do Saeb alinhada à BNCC

Catálogo das habilidades das matrizes de referência do Saeb **alinhadas à BNCC**, publicadas pelo
Inep em 2022 para Linguagens/Língua Portuguesa e Matemática — **distinto** da matriz tradicional
(2001) em `data/saeb-descritores/`, da base curricular completa da BNCC em `data/bncc/`, das escalas
de proficiência em `data/saeb-escalas/`, e de qualquer cruzamento interpretativo com o Currículo
Paulista (não implementado).

## Arquivos

- `source/official-inep-matrizes-bncc.json` — fonte hand-verified: as 262 habilidades (114
  Linguagens + 148 Matemática), cada uma lida e conferida visualmente contra a imagem renderizada da
  página do PDF oficial (nunca contra o texto extraído automaticamente — ver a seção "Metodologia" da
  Rodada 9 do relatório do piloto). Nunca editar o arquivo gerado a partir daqui manualmente.
- `matriz-linguagens-matematica-bncc.json` — **gerado** por
  `node scripts/saeb-matriz-bncc/gerar.mjs`. Nunca editar à mão.

## Origem dos dados

Todo o conteúdo deste catálogo reproduz o inventário aprovado na **Rodada 9** do relatório do piloto
(`C:\ProjetosIA\saeb-descritores-relatorio.html`), que documenta: URLs oficiais, hashes SHA-256,
tamanhos de arquivo, datas de consulta, metodologia de leitura visual (incluindo os trechos que a
extração automática corrompeu e como cada um foi confirmado), e a reconciliação de contagens em
múltiplas vias independentes. Esse relatório é a fonte de verdade documental — este diretório é a
sua tradução para dado versionado e consultável pelo código.

## Duas estruturas de código, nunca unificadas

- **Linguagens**: nenhum código oficial existe. Cada habilidade é identificada só pela posição na
  tabela (eixo do conhecimento × eixo cognitivo × ordem local dentro da célula). `codigoOficial` é
  sempre `null`; a `ordemEditorial` usada para desambiguar é uma localização **editorial deste
  catálogo**, nunca um código do Inep.
- **Matemática**: todas as 148 habilidades têm código oficial próprio desta matriz, no padrão
  `<etapa><Eixo><eixoCognitivo 1|2>.<sequencial>` (ex.: `9G2.7`) — um esquema que **não reaproveita
  nem se parece** com os códigos `D<n>` da matriz tradicional de 2001.

## Escopo

Só Linguagens/Língua Portuguesa e Matemática, nas etapas 2º/5º/9º ano do Ensino Fundamental — nenhuma
das duas matrizes BNCC auditadas cobre a 3ª série do Ensino Médio. As matrizes BNCC de Ciências da
Natureza e Ciências Humanas (confirmadas como existentes, mas não auditadas na Rodada 9) não são
importadas aqui.

Nenhuma aplicação da matriz de Linguagens/Matemática em 5º ou 9º ano numa edição específica do Saeb é
afirmada neste catálogo — ver `situacaoAplicacao` em cada fonte, que registra isso como
documentalmente inconclusivo (a única aplicação de 2019 confirmada nas fontes consultadas foi a
matriz do 2º ano, e Ciências Humanas/Ciências da Natureza no 9º ano — não Língua Portuguesa/
Matemática no 9º ano).

## Uso

```bash
npm run saeb:matriz-bncc:gerar   # gera/atualiza o catálogo a partir da fonte
npm run saeb:matriz-bncc:check   # verifica que o catálogo versionado está em dia (nunca escreve)
```

Consulta programática: `lib/saeb/matriz-bncc.ts` (tipos e funções de leitura — não integrado à
interface nesta rodada).
