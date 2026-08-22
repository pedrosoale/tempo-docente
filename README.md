# Tempo Docente

Plataforma de dados educacionais para professores da Educação Básica: consulta à
Base Nacional Comum Curricular (BNCC) com fonte oficial rastreável, relatório de
resultados do SARESP por escola, e (planejado) cruzamento com outras avaliações
externas como SAEB.

- **No ar em:** <https://tempodocente.com.br> (e também em
  <https://tempo-docente.pedrosoale.workers.dev>, o subdomínio `workers.dev` do
  Worker, que continua funcionando)
- **Repositório:** público, `main` é a branch de produção

## Estado atual

Módulo funcional: **BNCC — Ensino Fundamental**, com os 9 componentes curriculares
dos Anos Finais (6º ao 9º ano) completos, mais as 10 **Competências Gerais** da
Educação Básica — 1313 registros ao todo, todos extraídos do PDF oficial do MEC
com proveniência rastreada (fonte, URL, página, data de importação). **8 dos 9
componentes já cobrem o Ensino Fundamental inteiro, 1º ao 9º ano** (Matemática,
Língua Portuguesa, Arte, Educação Física, Ciências, Geografia, História, Ensino
Religioso). Só **Língua Inglesa** permanece 6º-9º, porque a própria BNCC não tem
Inglês nos Anos Iniciais — não é uma lacuna a preencher.

Módulo funcional: **BNCC — Ensino Médio**, Formação Geral Básica completa — as 4
áreas do conhecimento (Linguagens e suas Tecnologias, Matemática e suas
Tecnologias, Ciências da Natureza e suas Tecnologias, Ciências Humanas e Sociais
Aplicadas) e Língua Portuguesa (componente com peso próprio dentro de
Linguagens) — 204 registros (183 habilidades + 21 competências específicas).
Diferente do Fundamental, a BNCC do Médio não organiza por ano/série (a própria
lei que a instituiu prevê habilidades "sem indicação de seriação"), então a
navegação é por área/componente + competência específica; Língua Portuguesa é a
exceção, organizada por campo de atuação social. Os Itinerários Formativos não
entraram: o documento oficial não codifica habilidades pra eles (é orientação em
prosa pra redes/escolas montarem seus próprios percursos), então não há dado
estruturado pra extrair sem inventar o que a fonte não declara. Ver
[`data/bncc/README.md`](data/bncc/README.md) para o detalhamento por
componente/área e o pipeline de extração/importação de ambas as etapas.

Módulo funcional: **SARESP — relatório por escola**, em `/saresp`. Compara
proficiência 2024×2025 por escola sempre dentro do mesmo componente curricular e
série (nunca uma média cruzando Língua Portuguesa e Matemática), com benchmark
contra a **média das escolas do recorte** (mesma série, componente, rede e demais
filtros aplicados — ver "Metodologia do benchmark" abaixo, não é a média oficial da
SEDUC-SP), gap e sua evolução ano a ano, e diagnóstico automático sem causalidade
inventada. Cobre só Ensino Fundamental (2º, 5º e 9º ano) — o SARESP não avalia mais
o Ensino Médio desde 2023, isso passou a ser o Provão Paulista Seriado, publicado
separadamente e sem uma versão pré-agregada por escola equivalente à proficiência
usada aqui. Ver "Pipeline de dados do SARESP" abaixo.

**Ainda não importado** (roadmap, não implementado): Educação Infantil (BNCC).
SAEB e qualquer funcionalidade de IA/planejamento de aula/login **não existem
ainda** — os cartões correspondentes na home aparecem como "Em breve".

## Stack

- **Framework:** [vinext](https://github.com/cloudflare/vinext) (compatível com a
  API do Next.js App Router, mas roda nativamente em Cloudflare Workers) — React 19,
  TypeScript, Tailwind CSS 4.
- **Hospedagem:** Cloudflare Workers (Workers com Static Assets). Não é Vercel, não
  é hospedagem tradicional (PHP/Node genérico) — o projeto foi construído
  especificamente para rodar como Worker.
- **Dados:** JSON estático versionado em `data/bncc/*.json`, sem banco de dados. O
  conteúdo da BNCC muda raramente, então não há necessidade de escrita em runtime;
  `db/schema.ts` (Drizzle + D1) existe no starter mas está vazio e não é usado.

## Como rodar localmente

```bash
npm install
npm run dev        # servidor de desenvolvimento (Vite + Wrangler local)
npm run build      # gera o build de produção em dist/
npm start          # roda o build de produção localmente
npm test           # build + suíte de testes (node --test)
npm run lint
npm run typecheck  # tsc --noEmit --incremental false
```

Requer Node `>=22.13.0`.

## Deploy (Cloudflare Workers)

```bash
npm run deploy
```

Isso executa `vinext build` (gera `dist/server/wrangler.json` já configurado com
nome, assets e compatibility date) e em seguida `wrangler deploy` apontando pra esse
arquivo. Não existe `wrangler.toml` no projeto — o vinext gera a config do Worker a
cada build a partir de `vite.config.ts`.

**Pré-requisito:** `wrangler` autenticado numa conta Cloudflare (`npx wrangler login`
— abre o navegador para autorizar). A conta usada hoje é a de
`profe.pedroso@gmail.com`, subdomínio `workers.dev` registrado como `pedrosoale`
(por isso a URL é `tempo-docente.pedrosoale.workers.dev`).

Se `wrangler deploy` reclamar de conflito entre `wrangler.json` e
`.wrangler/deploy/config.json`, rode com `--config dist/server/wrangler.json`
explicitamente a partir da raiz do projeto (é o comando que `npm run deploy` já
usa).

### Domínio (`tempodocente.com.br`)

Registrado no registro.br, DNS migrado para os nameservers da Cloudflare
(`jen.ns.cloudflare.com` e `miles.ns.cloudflare.com`), zona ativa. `tempodocente.com.br`
e `www.tempodocente.com.br` estão configurados como Custom Domains do Worker
`tempo-docente` (Workers & Pages → `tempo-docente` → Settings → Domains & Routes),
com certificado SSL provisionado automaticamente pela Cloudflare.

Os registros de e-mail existentes no domínio (`MX` vazio, `TXT` SPF `-all`, `TXT`
DMARC `p=reject`) são intencionais — dizem "este domínio não envia e-mail" e foram
mantidos como estavam na zona da Cloudflare. **Isso significa que
`contato@tempodocente.com.br` (link no rodapé do site) não é funcional hoje** —
não há nenhum serviço de e-mail configurado para o domínio. Se isso for
configurado no futuro (Cloudflare Email Routing para encaminhamento gratuito, ou
Google Workspace/Zoho Mail para caixas de e-mail completas), os registros acima
precisam ser substituídos pelos que o provedor escolhido exigir.

## Estrutura do projeto

```text
app/                    rotas (App Router) e componentes de UI
  bncc/                 hub da BNCC, páginas por componente/ano, página de detalhe [codigo]
  saresp/                relatório SARESP: layout.tsx, page.tsx, saresp.css, componentes em
                          components/ (Filters.tsx, SchoolCombobox.tsx — busca de escola
                          acessível —, etc.)
  components/           Header, Footer, Hero, busca, etc. (compartilhados)
lib/bncc/
  types.ts              union de tipos dos registros da BNCC (ver abaixo)
  data.ts               carrega os datasets JSON, expõe getAllRegistros/getRegistroByCode/etc.
  search.mjs            filtro de busca/ano/unidade/objeto usado pelo explorer e pela busca global
lib/saresp/
  types.ts               tipos dos registros/agregações/artefatos do SARESP
  labels.ts               nomenclatura centralizada do benchmark ("média das escolas do recorte")
  analysis.ts             dedup de período, camada executiva, classificação, gap, diagnóstico,
                           identificação/busca de escola (índice, aliases, formatSchoolLabel)
data/bncc/               datasets finais (*.json) + relatórios de importação + README próprio
data/saresp/source/      CSVs brutos do SARESP (gitignored — ver "Pipeline de dados do SARESP")
public/data/saresp/      artefatos gerados servidos ao navegador — índice, camada executiva e
                          partições por escola (ver "Pipeline de dados do SARESP")
scripts/bncc/
  extract_*.py           extratores por componente (PyMuPDF, leem o PDF oficial do MEC)
  import.mjs              valida os snapshots extraídos e gera os datasets finais + relatórios
scripts/saresp/
  build-data.mjs          lê data/saresp/source/*.csv, gera os artefatos em public/data/saresp/
tests/                   node --test — importação, busca, HTML renderizado por rota, análise SARESP
worker/index.ts           entry point do Cloudflare Worker (roteamento de imagem + handler do vinext)
```

O modelo de dados (`lib/bncc/types.ts`) é um discriminated union por `tipo`
(`"habilidade" | "competencia_geral" | "competencia_especifica" | ...`), pensado
para caber Educação Infantil no futuro sem forçar a estrutura de Anos Finais
sobre ela. `HabilidadeMedio`/`CompetenciaEspecificaMedio` (Ensino Médio)
coexistem com `HabilidadeFundamental` na mesma union — sem campo `ano`, já que a
BNCC do Médio não é organizada por série. Cada registro carrega proveniência
completa (`fonte`, `fonte_url`, `documento_url`, `versao_fonte`, `pagina_fonte`,
`data_importacao`).

## Bug conhecido: não usar `next/link` para navegação

Todos os links de navegação do app (`app/**`) usam `<a href="...">` puro, **não**
`import Link from "next/link"`. Isso não é estilo, é uma correção deliberada: o
`<Link>` do vinext (`node_modules/vinext/dist/shims/link.js`) lança
`TypeError: <x> is not a function` dentro do `React.startTransition` ao navegar, no
build de produção rodando como Worker — reproduzido tanto na `1.0.0-beta.2` quanto
na `1.0.0-beta.5` (versão atual). Como o `<Link>` chama `e.preventDefault()` antes
de quebrar, o clique fica sem nenhum efeito (sem navegação, sem erro visível pro
usuário — só no console). `<a href>` simples não passa por esse código e funciona
via navegação de página inteira normal (o SSR de cada rota já é rápido o
suficiente).

**Antes de reintroduzir `next/link`/`<Link>` em qualquer página nova:** confirme
primeiro, num deploy real (não só `npm run dev`), que uma versão mais nova do
`vinext` corrigiu isso. Testar clicando em qualquer link após `npm run deploy`, com
o DevTools console aberto.

## Pipeline de dados da BNCC

Ver [`data/bncc/README.md`](data/bncc/README.md) para o processo completo (extração
por componente/área, formato do snapshot, correções tipográficas controladas e
documentadas, pegadinhas reais encontradas no Ensino Médio, como rodar
`npm run bncc:import`). Mesmo PDF oficial serve Fundamental e Médio — o
Fundamental usa um extrator por componente (`extract_<componente>.py`), o Médio
usa um extrator genérico por área (`extract_ensino_medio_area.py`) mais dois
dedicados (`extract_matematica_unidade_tematica.py`,
`extract_lingua_portuguesa_medio.py`). Resumo rápido:

```bash
pip install -r scripts/bncc/requirements.txt
python scripts/bncc/extract_official.py          # ou outro extract_*.py do componente/área
npm run bncc:import                                # valida + gera datasets finais + relatórios
npm run bncc:validate                               # checagem + teste de importação
```

Nunca edite os arquivos em `data/bncc/*.json` manualmente — eles são gerados por
`import.mjs` a partir de `data/bncc/source/*.json`. Qualquer correção de texto
precisa ser uma correção controlada e documentada no próprio script de extração
(ver exemplos em `scripts/bncc/extract_official.py`), nunca uma edição direta do
dado importado.

## Pipeline de dados do SARESP

Diferente do BNCC, o CSV bruto do SARESP **não fica no git** (~15MB, só serve pra
regenerar o JSON — ver `.gitignore`). Fonte oficial: ["Proficiência do SARESP por
Escola"](https://dados.educacao.sp.gov.br/dataset/profici%C3%AAncia-do-sistema-de-avalia%C3%A7%C3%A3o-de-rendimento-escolar-do-estado-de-s%C3%A3o-paulo-saresp-60),
Dados Abertos da Educação (SP). Pra atualizar os dados (ex.: quando sair o SARESP de
2026): baixe `Proficiência do SARESP por escola de <ano>`, salve como
`data/saresp/source/saresp-<ano>.csv` (mesmas colunas: `DEPADM;DEPBOL;NOMEDEPBOL;
CODRMET;CODESC;NOMESC;SERIE_ANO;COD_PER;PERIODO;CO_COMP;DS_COMP;MEDPROF`) e rode:

```bash
npm run saresp:build-data    # lê os CSVs, gera os artefatos em public/data/saresp/
```

Os artefatos gerados **são** commitados (diferente do CSV) porque são o que o app
de fato serve em produção — sem eles `/saresp` quebra, já que (igual ao BNCC) não
há hook `predev`/`prebuild` regenerando automaticamente, é manual e intencional.
Nunca edite esses arquivos à mão — para incluir/remover um campo, edite
`scripts/saresp/build-data.mjs` e rode `npm run saresp:build-data` de novo.

**Por que `public/data/saresp/*.json` e não `data/saresp/*.json` importado
estaticamente** (como o BNCC faz): se fossem importados estaticamente e passados
como prop pra um client component, esse payload seria serializado no HTML de
hidratação da página. Em vez disso, `app/saresp/components/SarespReport.tsx`
(`"use client"`) faz `fetch()` deles no mount — só o suficiente pra pintar a página
aparece no HTML inicial, o dado pesado chega depois, assíncrono, evitando a
duplicação payload-no-HTML-+-payload-no-fetch. Quais arquivos são buscados, quando
e por quê é o que a seção seguinte descreve.

### Artefatos em `public/data/saresp/` (índice + camada executiva + partições)

Até a rodada anterior o pipeline gerava só dois arquivos combinados
(`saresp-2024.json`/`saresp-2025.json`, ~27,11MB crus / ~1.360KB gzip somados), e o
navegador baixava os dois inteiros em toda visita a `/saresp`, mesmo pra consultar
uma única escola — limitação arquitetural documentada desde o commit `c97ca16` e
deliberadamente adiada até esta rodada. Foi substituído por um índice leve sempre
carregado + dados particionados sob demanda:

- **`schools-index.json`** (967.015 bytes / ~159KB gzip, 9.760 entradas) —
  identidade leve por escola (`codesc, nomesc, rede, codrmet`). Uma entrada por
  `codesc`, com o nome mais recente quando a escola foi renomeada entre 2024 e
  2025 (`buildSchoolIndex`, que reusa a mesma `latestIdentityByCode` já usada na
  identificação de escola — ver abaixo).
- **`schools-aliases.json`** (1.973 bytes / ~954 bytes gzip) — só as escolas que
  mudaram de nome entre 2024 e 2025 (43 das 9.760, medido por
  `buildSchoolAliases`): `codesc` → lista dos nomes antigos. Fica separado do
  índice porque embutir a busca-por-nome-antigo em toda entrada do índice saiu
  caro numa primeira versão testada (`searchKey` com todos os apelidos embutido
  nas 9.760 entradas: +140KB gzip pra um benefício que afeta só 43 escolas) —
  descartada em favor deste arquivo pequeno, mesclado ao índice no cliente
  (`withSearchKey`) só para montar a chave de busca.
- **`executive.json`** (6.292.308 bytes / ~514KB gzip) — a camada executiva (uma
  linha por `codesc × serieAno × componente`, prof2024/prof2025 já casados),
  gerada chamando a mesma `makeExecutiveComparison` de `analysis.ts` usada nos
  testes, na forma enxuta `ExecutiveRowSeed` (sem `diff`/`percent`/`tone`/
  `statusLabel` — esses campos derivados são recomputados no cliente via
  `withVariation`, hoje exportada). É essa camada que alimenta os cartões-resumo,
  o comparativo Escola × Recorte, o gráfico de evolução, o diagnóstico e os
  rankings — pra uma escola já resolvida, tudo isso pinta a partir do que já está
  em memória, sem fetch adicional.
- **`executive-manha.json`** (4.971.164 bytes / ~426KB gzip), **`executive-
  tarde.json`** (3.598.841 bytes / ~303KB gzip) e **`executive-noite.json`**
  (1.114 bytes / 311 bytes gzip) — variantes da camada executiva pré-filtradas
  por período, buscadas sob demanda só quando o filtro Período é MANHÃ/TARDE/
  NOITE. Existem porque o filtro de período é aplicado **antes** de
  `makeExecutiveComparison` rodar — sem essas variantes, escolher MANHÃ/TARDE
  pararia de afetar Rankings/gráficos/benchmark assim que a página passasse a
  depender só do `executive.json` padrão (que colapsa por `GERAL`). Não é caso
  raro: medido nos dados reais, 79% dos grupos `codesc×serieAno×componente` têm
  linha MANHÃ e 57% têm TARDE, contra 100% com `GERAL` — por isso `GERAL` não
  precisa de variante própria, mas MANHÃ/TARDE precisam.
- **`schools/<codesc>.json`** (9.760 arquivos, mediana 1.641 bytes, média 1.585
  bytes, de 403 a 3.701 bytes) — as linhas cruas de uma escola (os dois anos,
  todos os períodos), na forma enxuta `{year, serieAno, periodo, componente,
  medprof}` (sem `codesc`/`rede`/`codrmet`/`nomesc` — recuperáveis do índice já
  carregado). Buscado sob demanda só pras escolas efetivamente resolvidas pela
  busca atual, e só alimenta a tabela detalhada por período (`ComparisonTable`) e
  a exportação CSV — o resto da página, como listado acima, não depende dessas
  partições.

**Cap de busca ambígua (`SCHOOL_MATCH_LIMIT = 30`, em `lib/saresp/analysis.ts`):**
um termo comum ("prof", por exemplo) bate em milhares de escolas (4.417 das
9.760, medido) — sem limite, resolver cada uma delas em paralelo dispararia
milhares de fetches de partição a partir de poucas teclas digitadas. Acima do
cap, a página só informa quantas escolas correspondem e pede pra refinar a
busca, sem buscar nenhuma partição; abaixo do cap — incluindo o caso comum de
uma escola só — busca em paralelo normalmente. O mesmo cap limita quantas
sugestões o combobox de busca (`SchoolCombobox.tsx`) renderiza de uma vez; ver
"Identificação de escolas" abaixo.

**Medido nesta rodada** (bytes crus / gzip): o baseline sempre carregado
(`schools-index.json` + `schools-aliases.json` + `executive.json`) caiu de
~27,11MB / ~1.360KB gzip (os dois arquivos antigos combinados) para ~6,92MB /
~653KB gzip — **74,5% de redução em bytes crus, 52,0% em gzip**. Gzip é a
métrica que importa de verdade: o Cloudflare já comprime `/data/*.json`
automaticamente em produção (confirmado via
`curl -I -H "Accept-Encoding: gzip, br"` mostrando `Content-Encoding: br`,
porque esses arquivos são servidos direto pelo pipeline de assets estáticos,
nunca passam por `worker/index.ts`), e os JSONs antigos já comprimiam bem,
porque cada escola repetia `nomesc`/`rede`/`codrmet` em 15-36 linhas cruas —
exatamente o que compressão por dicionário aproveita. Por isso a redução real
de tráfego é ~52%, não os ~75% que os bytes crus sozinhos sugerem — ainda uma
vitória real, só que com o número honesto. As variantes de período e as
partições por escola só entram quando de fato usadas: a maioria das visitas
que consulta uma escola específica nunca baixa mais que o baseline mais uma
partição de poucos KB.

A lógica de cálculo (dedup de período — prioriza o registro `GERAL` quando existe,
nunca soma Português+Matemática numa média só, classificação em 4 categorias contra
o benchmark do recorte, gap e sua evolução, diagnóstico sem causalidade, índice e
aliases de escola) está em `lib/saresp/analysis.ts`, tipada e sem I/O.
`scripts/saresp/build-data.mjs` importa `buildSchoolIndex`/`buildSchoolAliases`/
`makeExecutiveComparison` direto desse arquivo (extensão `.ts` explícita) em vez de
duplicar a lógica — só a metade de parsing de CSV (`splitCsvLine`, `decodeCsv`,
`cleanText`, `mojibakeFixes`) continua exclusiva do script. Isso funciona porque
`node --experimental-strip-types` (flag explícita no script `saresp:build-data` do
`package.json`, mesma defesa que o script `test` já usa) carrega `.ts` direto sem
bundler — o mesmo mecanismo que já permitia `tests/saresp-analysis.test.mjs`
importar `lib/saresp/analysis.ts`/`types.ts`, que por sua vez importam um do outro
com extensão `.ts` explícita (`allowImportingTsExtensions` no `tsconfig.json`).

O SARESP não cobre Ensino Médio: desde 2023 o EM é avaliado pelo Provão Paulista
Seriado, publicado junto com o SARESP só como microdados por aluno (~200MB/ano, sem
versão pré-agregada por escola). Agregar esse microdado por conta própria arriscaria
não bater com a proficiência oficial (que normalmente usa escala psicométrica/TRI,
não média simples) — por isso essa fonte não foi usada.

### Metodologia do benchmark ("média das escolas do recorte")

O número comparado contra cada escola em `/saresp` **não é a média oficial da rede
estadual** divulgada pela SEDUC-SP. É a média simples (não ponderada por matrícula)
da proficiência de todas as escolas que atendem aos filtros aplicados no momento —
mesma série/ano, componente curricular, rede e demais filtros ativos
(`buildStateBenchmark` em `lib/saresp/analysis.ts`, agrupada estritamente por
`serieAno|componente`, nunca misturando série ou componente diferentes). A UI
chama esse valor de "média das escolas do recorte" (não "média do Estado") e expõe
essa explicação diretamente na página — ver o texto centralizado em
`lib/saresp/labels.ts`, que é a única fonte da palavra usada em toda a interface e
nas frases do diagnóstico, para o texto nunca divergir entre componentes.

Por que não pesar por matrícula: o CSV oficial de proficiência por escola não traz
o número de alunos avaliados por registro — só a proficiência agregada. Ponderar
sem esse dado exigiria estimar/inventar um peso, o que é exatamente o tipo de dado
fabricado que este projeto evita. Se a SEDUC-SP publicar matrícula por registro no
futuro, uma média ponderada real passa a ser possível.

### Identificação de escolas

O CSV oficial tem escolas homônimas com `CODESC` (código escolar) diferente — ex.:
duas escolas chamadas "CASTRO ALVES" (códigos `875` e `33613`), 36 nomes duplicados
nas ~9.500 escolas do arquivo de 2024. `CODESC` é o único campo garantidamente
único por escola nessa base; nome, rede e `CODRMET` sozinhos não bastam (a maioria
dos nomes duplicados está na mesma rede, e alguns até compartilham o mesmo
`CODRMET`).

Por isso:

- O pipeline (`scripts/saresp/build-data.mjs` → `schools-index.json`) preserva
  `codrmet` ("Código da Região Metropolitana" segundo o [dicionário de dados
  oficial](https://dados.educacao.sp.gov.br/dicionario-de-dados-proficiencia-saresp),
  um agrupamento numérico opaco sem nome público nesta base) além de `codesc`,
  `nomesc` e `rede` — confirmado 100% invariante por `codesc` nos dados reais, por
  isso o filtro de rede é aplicado no cliente, sem variante pré-computada por rede.
- A busca de escola em `/saresp` (`SchoolCombobox.tsx`) é um combobox acessível
  (padrão WAI-ARIA APG — `role="combobox"` + `role="listbox"`,
  `aria-activedescendant`, navegação completa por teclado) que monta cada sugestão
  como `"Nome — Rede · Região N — Cód. CODESC"` (`formatSchoolLabel` em
  `lib/saresp/analysis.ts`), uma por `codesc` — nunca uma por `nomesc`. Isso
  substitui o antigo `<datalist>` nativo, que sempre renderiza um `<option>` por
  escola no DOM (as 9.760) independente do que foi digitado, porque o navegador só
  filtra visualmente; o combobox novo renderiza só os `SCHOOL_MATCH_LIMIT` (30)
  primeiros resultados (ver "Cap de busca ambígua" acima). Escolher uma sugestão
  passa o `codesc` direto pro estado — sem parsear sufixo de texto —, então duas
  escolas com nome igual continuam individualmente selecionáveis. Texto livre que
  bate em várias escolas dentro do cap mostra o comparativo combinado das escolas
  casadas, com a coluna "Código" (abaixo) pra distinguir cada linha; acima do cap,
  a página só informa quantas escolas correspondem e pede pra refinar a busca.
- Escolas renomeadas entre 2024 e 2025 (43 das 9.760 — ver `schools-aliases.json`
  acima) continuam buscáveis pelo nome antigo: o cliente mescla índice e aliases
  (`withSearchKey`) pra montar a chave de busca de cada escola, embora a sugestão
  exibida sempre mostre o nome atual.
- Com uma escola resolvida, a página mostra "Escola selecionada: Nome — Rede ·
  Região N — Cód. CODESC" acima dos indicadores, e a tabela detalhada ganhou uma
  coluna "Código", para confirmar visualmente qual escola física está em tela.

**Limitação conhecida:** o [dicionário de dados oficial da SEDUC-SP](https://dados.educacao.sp.gov.br/dicionario-de-dados-proficiencia-saresp)
lista campos de município (`codmun`/`mun`) e diretoria de ensino (`DE`, em texto)
que **não existem** nas colunas do CSV atualmente salvo em
`data/saresp/source/*.csv` (`DEPADM;DEPBOL;NOMEDEPBOL;CODRMET;CODESC;NOMESC;
SERIE_ANO;COD_PER;PERIODO;CO_COMP;DS_COMP;MEDPROF` — confirmado batendo com o
cabeçalho real do arquivo). Não foi inventado um nome para os 7 valores de
`codrmet` (1-7) nem uma diretoria/município fabricados: o rótulo mostra o código
numérico cru ("Região 5"), não um nome de região. Se um export mais novo do
dataset oficial vier com essas colunas, dá pra enriquecer o rótulo com
município/diretoria de verdade — até lá, `codesc` é o identificador confiável e
`codrmet` é só um desempate geográfico aproximado.

## Sobre os arquivos herdados do template

Este projeto começou a partir do starter oficial do vinext (`vinext-starter`), que
foi desenhado para rodar na hospedagem interna da OpenAI ("Sites"). `app/
chatgpt-auth.ts` (helpers de login via ChatGPT — nenhuma página do site importava
esse arquivo) era um resquício confirmado sem uso e foi removido.

`.openai/hosting.json` **não é resíduo removível**, apesar de declarar bindings D1/
R2 hoje `null`: `vite.config.ts` faz `import hostingConfig from "./.openai/
hosting.json"` e usa `{ d1, r2 }` pra montar a config local do Wrangler — removê-lo
quebra `npm run dev`/`npm run build`. Fica documentado aqui porque essa afirmação
("é resíduo do starter, sem uso") estava incorreta numa versão anterior deste
README.

`db/` (Drizzle + D1, ver "Stack" acima) e `examples/d1/` seguem sem uso confirmado,
mas não foram removidos nesta rodada — só a remoção de `app/chatgpt-auth.ts` foi
verificada (zero importadores em todo o repo) com segurança suficiente para agir
sem checar cada consumidor em profundidade. `db/` continua compilando corretamente
(ver `worker/cloudflare-env.d.ts`) como scaffold opcional, não como erro pendente.

## Pendências conhecidas

Itens identificados numa revisão de confiabilidade estatística, identificação de
escolas, TypeScript e testes do SARESP, mas deliberadamente **não** implementados
nesta rodada — cada um envolve uma mudança de escopo maior que merece sua própria
revisão:

- **Sitemap** (`app/sitemap.ts`) — **resolvido**: agora inclui `/saresp`,
  `/bncc/ensino-medio` e as 5 áreas do Ensino Médio, além das rotas que já existiam
  (home, `/bncc`, Competências Gerais, Ensino Fundamental, os 9 componentes e suas
  páginas por ano, e a página `/bncc/<código>` de cada registro com código). Coberto
  por `tests/sitemap.test.mjs` (11 testes): presença das rotas principais, do Ensino
  Médio e do SARESP; ausência de URLs duplicadas, com parâmetro/fragmento ou de
  funcionalidades "Em breve"; domínio canônico em toda URL; e uma contagem total
  exata, recalculada a partir dos datasets brutos da BNCC, que pega qualquer rota
  perdida ou adicionada por engano.
- **CI** — **resolvido**: `.github/workflows/ci.yml` roda `npm ci`, `npm run lint`,
  `npm run typecheck` e `npm test` (que inclui `npm run build`) a cada pull request e
  a cada push em `main`, com permissões mínimas (`contents: read`), timeout de 15
  minutos e cancelamento automático de execuções antigas da mesma branch. Não faz
  deploy nem usa segredos.
- **Avisos de imagem do ESLint** (`@next/next/no-img-element` em `Header.tsx`/
  `Footer.tsx`): trocar `<img>` por `next/image` não foi feito porque o próprio
  `<Link>` do vinext já quebra em produção como Worker (ver "Bug conhecido" acima)
  — antes de reintroduzir outro componente do `next/*` em produção real, vale
  confirmar num deploy de teste que `next/image` funciona nesse runtime, o que
  este trabalho não cobriu.
