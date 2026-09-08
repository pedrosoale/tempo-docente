# Importador do SAEB

Este diretório guarda o manifesto versionado (`manifest.json`) e, localmente e fora do
Git, o cache de pacotes oficiais (`source/`) e o log da última execução
(`last-run.log`). O código do importador vive em [`scripts/saeb/`](../../scripts/saeb/).

## Origem oficial dos três pacotes

A edição piloto é 2025, ancorada nos três pacotes de divulgação do Ideb **por escola**,
publicados pelo Inep:

| Pacote | Etapa | URL |
| --- | --- | --- |
| `divulgacao_anos_iniciais_escolas_2025.zip` | Ensino Fundamental — Anos Iniciais | `download.inep.gov.br/ideb/resultados/…` |
| `divulgacao_anos_finais_escolas_2025.zip` | Ensino Fundamental — Anos Finais | `download.inep.gov.br/ideb/resultados/…` |
| `divulgacao_ensino_medio_escolas_2025.zip` | Ensino Médio | `download.inep.gov.br/ideb/resultados/…` |

As URLs completas, tamanhos e hashes fixados estão em
[`scripts/saeb/lib/sources.mjs`](../../scripts/saeb/lib/sources.mjs) — esse arquivo é a
única fonte de verdade sobre "de onde vêm os dados"; este README não duplica os valores
para não divergir deles com o tempo.

Página oficial de referência: `gov.br/inep` → Ideb → Resultados 2005–2025.

## MD5 oficial × fingerprint SHA-256 local — não são a mesma coisa

O manifesto registra dois tipos de hash, com proveniências diferentes:

- **`xlsx_md5_oficial`** — o checksum que o próprio Inep publica dentro de cada pacote
  (`md5_*.txt`). A cópia fixada em `sources.mjs` serve para confrontar o que vier no
  pacote baixado com o que foi revisado a portas fechadas. As duas cópias têm a mesma
  origem editorial — **não são testemunhas independentes**.
- **`zip_sha256_local` / `xlsx_sha256_local`** — fingerprints calculados sobre os bytes
  de um download já revisado. O Inep **não publica** SHA-256; são um controle local
  para detectar adulteração em trânsito ou em repouso no cache, inclusive quando o
  tamanho do arquivo é preservado.

Nunca chame a verificação de tamanho de "checksum", nem apresente as duas camadas como
"duas origens independentes" — nenhuma das duas afirmações é verdadeira, e há um teste
(`o código-fonte não chama verificação de tamanho de checksum…`) que garante que essa
linguagem não volte ao código.

## Os quatro modos

```
node scripts/saeb/import.mjs --download        # npm run saeb:download
node scripts/saeb/import.mjs                   # npm run saeb:import
node scripts/saeb/import.mjs --check           # npm run saeb:check
node scripts/saeb/import.mjs --verify-source   # npm run saeb:verify
```

| Modo | Rede | Lê | Escreve | Pergunta que responde |
| --- | --- | --- | --- | --- |
| `--download` | sim | — | `data/saeb/source/*.zip` | "os pacotes em cache são estes, validados por completo?" |
| normal (sem flag) | não | cache | manifesto + `public/data/saeb/**` | "materialize os artefatos a partir do cache." |
| `--check` | não | cache + saída atual | nada | "o que já está em `public/data/saeb` bate com o que o cache produziria?" — relata ausência, divergência e órfãos. |
| `--verify-source` | não | cache + `manifest.json` | nada | "os três pacotes em cache, passados pelo parser, ainda produzem o manifesto já commitado?" — nunca olha para `public/data/saeb`, exista ele ou não. |

`--check` e `--verify-source` respondem perguntas diferentes e **não são
substituíveis**: `--check` audita uma materialização; `--verify-source` audita a fonte e
o parser contra o manifesto, independentemente de a materialização existir. Por isso são
mutuamente exclusivos entre si e com `--download`; `--verify-source` também não aceita
`--out` (não há saída para redirecionar). Ambos aceitam `--cache <dir>` para apontar para
um cache alternativo (útil em revisão e nos próprios testes).

### O que `--verify-source` faz, exatamente

1. Lê os três pacotes do cache (sem rede) e prova a integridade de cada um: tamanho,
   fingerprint SHA-256 local do ZIP e da planilha, MD5 oficial e estrutura interna do
   pacote.
2. Percorre a planilha inteira de cada um dos três XLSX, validando cabeçalho, colunas
   obrigatórias, valores e marcadores de ausência — a mesma extração usada pelo modo
   normal, sem atalho nem amostragem.
3. Roda as mesmas checagens de duplicidade e conflito de escola/município que o modo
   normal roda.
4. Reconstrói partições, índice e manifesto inteiramente em memória.
5. Compara os **bytes canônicos** do manifesto reconstruído com `data/saeb/manifest.json`
   byte a byte — sem ignorar nenhum campo.
6. Não cria, não apaga e não modifica nada no disco. Se o manifesto estiver ausente ou
   divergente, o comando **falha** em vez de gerar ou corrigir — atualizar o manifesto é
   sempre um ato deliberado (rodar o modo normal e revisar o diff), nunca automático.

## Requisitos de cache para `saeb:verify`

`npm run saeb:verify` exige os três ZIPs oficiais já baixados em `data/saeb/source/`
(por `npm run saeb:download`) e o `data/saeb/manifest.json` já commitado. Sem isso, ele
falha com uma mensagem apontando o que falta — nunca baixa nada sozinho.

## Quando rodar `saeb:verify` antes de commitar

**Obrigatório** antes de commitar qualquer alteração em:

- `scripts/saeb/lib/zip.mjs` ou `scripts/saeb/lib/xlsx.mjs` (leitores);
- `scripts/saeb/lib/sources.mjs` (registro de fontes, hashes, colunas);
- `scripts/saeb/lib/normalize.mjs` (normalização de valores e marcadores);
- `scripts/saeb/import.mjs`, nas partes que montam dados ou manifesto
  (`montarArtefatos`, `montarManifesto`, `construirDataset`).

Rodar `npm test` sozinho **não é suficiente** para essas mudanças — ver a seção
seguinte.

## `npm test` usa fixtures sintéticas; a verificação real é outra coisa

A suíte (`tests/saeb-import.test.mjs`) roda inteiramente sobre ZIPs e planilhas
sintéticas, construídas em memória por `tests/helpers/saeb-fixtures.mjs`. Isso é
deliberado: os testes rodam em milissegundos, sem rede, e cabem em CI. Os ZIPs oficiais
**não estão** na suíte nem na CI — nunca serão adicionados a nenhuma das duas.

A prova de que o leitor e o parser funcionam contra a estrutura real do Inep é
`npm run saeb:verify`, um procedimento **local e manual**, separado da CI, que só roda
quando alguém já tem os pacotes em cache. Trate-o como um gate de revisão, não como um
teste automatizado.

## O que ainda não existe

- **Partições públicas** (`public/data/saeb/municipios/*.json` e
  `municipios-index.json`) ainda não foram materializadas neste repositório. O
  manifesto e a suíte de testes já preveem o formato; a materialização é uma decisão em
  aberto, tratada separadamente da etapa explicativa (`/saeb`).
- **A planilha agregada do SAEB 2025** (`saeb_2025_brasil_estados_municipios_
  censitario.xlsx`) continua fora de escopo: o Inep não publica MD5 oficial para ela, e
  a verificação de MD5 é requisito obrigatório deste importador. Ver
  `criterios.exclusao` em `manifest.json`.
- **Decisão de arquitetura de assets pendente**: onde e como as ~5.571 partições por
  município deveriam ser servidas em produção (embutidas no build, num bucket
  separado, geradas sob demanda etc.) ainda não foi decidido. Este importador produz o
  formato canônico; a decisão de distribuição é posterior e não está implementada.
