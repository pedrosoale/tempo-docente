# Tempo Docente

Plataforma de dados educacionais para professores da Educação Básica: consulta à
Base Nacional Comum Curricular (BNCC) com fonte oficial rastreável, e (planejado)
cruzamento com avaliações externas como SAEB e SARESP.

- **No ar em:** <https://tempodocente.com.br> (e também em
  <https://tempo-docente.pedrosoale.workers.dev>, o subdomínio `workers.dev` do
  Worker, que continua funcionando)
- **Repositório:** público, `main` é a branch de produção

## Estado atual

Módulo funcional: **BNCC — Ensino Fundamental**, com os 9 componentes curriculares
dos Anos Finais (6º ao 9º ano) completos, mais as 10 **Competências Gerais** da
Educação Básica — 865 registros ao todo, todos extraídos do PDF oficial do MEC com
proveniência rastreada (fonte, URL, página, data de importação). **Matemática** já
cobre o Ensino Fundamental inteiro, 1º ao 9º ano (Anos Iniciais + Anos Finais,
247 habilidades); os outros 8 componentes ainda só têm Anos Finais. Ver
[`data/bncc/README.md`](data/bncc/README.md) para o detalhamento por componente e o
pipeline de extração/importação.

**Ainda não importado** (roadmap, não implementado): Anos Iniciais (1º ao 5º ano)
dos outros 8 componentes, Educação Infantil, Ensino Médio. SAEB, SARESP e qualquer
funcionalidade de IA/planejamento de aula/login **não existem ainda** — os cartões
correspondentes na home aparecem como "Em breve".

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
npm run dev      # servidor de desenvolvimento (Vite + Wrangler local)
npm run build    # gera o build de produção em dist/
npm start        # roda o build de produção localmente
npm test         # build + suíte de testes (node --test)
npm run lint
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
  components/           Header, Footer, Hero, busca, etc. (compartilhados)
lib/bncc/
  types.ts              union de tipos dos registros da BNCC (ver abaixo)
  data.ts               carrega os datasets JSON, expõe getAllRegistros/getRegistroByCode/etc.
  search.mjs            filtro de busca/ano/unidade/objeto usado pelo explorer e pela busca global
data/bncc/               datasets finais (*.json) + relatórios de importação + README próprio
scripts/bncc/
  extract_*.py           extratores por componente (PyMuPDF, leem o PDF oficial do MEC)
  import.mjs              valida os snapshots extraídos e gera os datasets finais + relatórios
tests/                   node --test — importação, busca, HTML renderizado por rota
worker/index.ts           entry point do Cloudflare Worker (roteamento de imagem + handler do vinext)
```

O modelo de dados (`lib/bncc/types.ts`) é um discriminated union por `tipo`
(`"habilidade" | "competencia_geral" | ...`), pensado para caber Educação Infantil e
Ensino Médio no futuro sem forçar a estrutura de Anos Finais sobre eles. Cada
registro carrega proveniência completa (`fonte`, `fonte_url`, `documento_url`,
`versao_fonte`, `pagina_fonte`, `data_importacao`).

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
por componente, formato do snapshot, correções tipográficas controladas e
documentadas, como rodar `npm run bncc:import`). Resumo rápido:

```bash
pip install -r scripts/bncc/requirements.txt
python scripts/bncc/extract_official.py          # ou outro extract_*.py do componente
npm run bncc:import                                # valida + gera datasets finais + relatórios
npm run bncc:validate                               # checagem + teste de importação
```

Nunca edite os arquivos em `data/bncc/*.json` manualmente — eles são gerados por
`import.mjs` a partir de `data/bncc/source/*.json`. Qualquer correção de texto
precisa ser uma correção controlada e documentada no próprio script de extração
(ver exemplos em `scripts/bncc/extract_official.py`), nunca uma edição direta do
dado importado.

## Sobre os arquivos herdados do template

Este projeto começou a partir do starter oficial do vinext (`vinext-starter`), que
foi desenhado para rodar na hospedagem interna da OpenAI ("Sites"). Os seguintes
arquivos são resquícios desse starter e **não estão em uso** nesta aplicação:
`.openai/hosting.json` (declara bindings D1/R2 opcionais, ambos `null` hoje),
`app/chatgpt-auth.ts` e as rotas `/signin-with-chatgpt` (login via ChatGPT — nenhuma
página do site usa isso). Podem ser removidos com segurança se algum dia
atrapalharem; foram deixados por não interferirem em nada do funcionamento atual.
