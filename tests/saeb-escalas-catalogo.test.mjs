// Testes do gerador determinístico do catálogo de escalas (scripts/saeb-escalas/gerar.mjs).
// Nenhuma rede, nenhum PDF, nenhum pacote oficial de resultados — só o arquivo-fonte já verificado
// (data/saeb-escalas/source/official-inep-escalas-lp-mt.json) e fixtures pequenas escritas em
// arquivos temporários para os casos de divergência estrutural/semântica.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { EscalasGeracaoError, gerar, verificar } from "../scripts/saeb-escalas/gerar.mjs";

const CATALOGO_REAL_PATH = fileURLToPath(new URL("../data/saeb-escalas/escalas-lp-mt.json", import.meta.url));

const ETAPAS_PILOTO = ["anosIniciais", "anosFinais", "ensinoMedio"];
const COMPONENTES_PILOTO = ["lp", "mt"];

function nivel(overrides) {
  return {
    nivel: 0,
    nomeNivel: "Nível 0",
    origemNome: "quadro",
    tabulado: true,
    limiteInferior: null,
    operadorInferior: null,
    limiteSuperior: null,
    operadorSuperior: null,
    descricaoOficial: "Descrição de teste.",
    paginasPdf: [1],
    paginasImpressas: [1],
    ...overrides,
  };
}

function niveisValidos() {
  return [
    nivel({ nivel: 0, nomeNivel: "Abaixo do Nível 1", origemNome: "nota_rodape", tabulado: false, limiteSuperior: 200, operadorSuperior: "<" }),
    nivel({ nivel: 1, nomeNivel: "Nível 1", limiteInferior: 200, operadorInferior: ">=", limiteSuperior: 300, operadorSuperior: "<" }),
    nivel({ nivel: 2, nomeNivel: "Nível 2", limiteInferior: 300, operadorInferior: ">=" }),
  ];
}

/** Uma escala de teste válida para um par etapa/componente específico. O catálogo real cobre as
 * três etapas do piloto × dois componentes (seis escalas) — uma fixture com menos que isso é
 * rejeitada pela checagem de escopo em gerar(), então toda fixture "válida" usada como ponto de
 * partida precisa das seis. */
function escalaValida(etapa, componente, overrides = {}) {
  return {
    etapa,
    etapaLabelOficial: `Etapa de teste — ${etapa}`,
    componente,
    quadro: `Quadro de teste — ${etapa}/${componente}`,
    tituloOficial: `Escala de teste — ${etapa}/${componente}`,
    fonteInternaCitada: "Fonte: teste.",
    niveis: niveisValidos(),
    ...overrides,
  };
}

function fonteValida() {
  return {
    titulo: "Publicação de teste",
    orgao: "Órgão de teste",
    // Precisa pertencer ao domínio oficial do Inep — a fixture usa um subdomínio real
    // (download.inep.gov.br), como a fonte de produção, para não depender de nenhuma
    // particularidade do host além do sufixo ".inep.gov.br".
    url: "https://download.inep.gov.br/publicacoes/teste/escala-teste.pdf",
    versaoPublicacao: "Edição de teste",
    hashSha256: "a".repeat(64),
    totalPaginasPdf: 3,
  };
}

/** As seis escalas do escopo completo (anosIniciais/anosFinais/ensinoMedio × lp/mt), na mesma
 * ordem usada pelos índices dos testes abaixo (fixture.escalas[0] é sempre anosIniciais/lp). */
function fixtureValida() {
  return {
    fonte: fonteValida(),
    escalas: ETAPAS_PILOTO.flatMap((etapa) => COMPONENTES_PILOTO.map((componente) => escalaValida(etapa, componente))),
  };
}

let dir;
test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "saeb-escalas-teste-"));
});
test.afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function gerarComFixture(fixture, opcoes = {}) {
  const caminho = join(dir, "fonte.json");
  writeFileSync(caminho, JSON.stringify(fixture), "utf-8");
  return gerar({ fontePath: caminho, escrever: opcoes.escrever ?? false, saidaPath: opcoes.saidaPath });
}

test("gerar: fixture estruturalmente válida produz um catálogo com schema, piloto e as seis escalas (3 etapas × 2 componentes)", () => {
  const { catalogo } = gerarComFixture(fixtureValida());
  assert.equal(catalogo.schema, "saeb-escalas-piloto/2");
  assert.deepEqual(
    catalogo.escalas.map((e) => `${e.etapa}/${e.componente}`).sort(),
    ["anosFinais/lp", "anosFinais/mt", "anosIniciais/lp", "anosIniciais/mt", "ensinoMedio/lp", "ensinoMedio/mt"],
  );
  assert.deepEqual(catalogo.piloto.componentes, ["lp", "mt"]);
  assert.deepEqual(catalogo.piloto.etapas, ["anosIniciais", "anosFinais", "ensinoMedio"]);
});

test("gerar: inclui 2025 nas edições associadas de toda escala, e não carrega mais uma lista de edições excluídas", () => {
  const { catalogo } = gerarComFixture(fixtureValida());
  for (const escala of catalogo.escalas) {
    assert.ok(escala.edicoesAssociadas.includes("2025"), `${escala.etapa}/${escala.componente} deveria incluir 2025`);
  }
  // A rodada "2025" removeu piloto.edicoesExcluidas — 2025 deixou de ser uma exclusão documentada
  // para virar uma edição associada como qualquer outra.
  assert.equal(catalogo.piloto.edicoesExcluidas, undefined);
});

test("gerar: determinístico — duas gerações da mesma fonte produzem bytes idênticos", () => {
  const fixture = fixtureValida();
  const primeira = gerarComFixture(fixture);
  const segunda = gerarComFixture(fixture);
  assert.equal(primeira.texto, segunda.texto);
});

test("gerar: determinístico sobre a fonte real do projeto — duas gerações produzem bytes idênticos", () => {
  const primeira = gerar({ escrever: false });
  const segunda = gerar({ escrever: false });
  assert.equal(primeira.texto, segunda.texto);
});

test("gerar: primeira gravação escreve (escrito:true); regravar a mesma fonte não toca o arquivo (escrito:false, mtime preservado)", () => {
  const fixture = fixtureValida();
  const fonte = join(dir, "fonte.json");
  const saida = join(dir, "escalas-lp-mt.json");
  writeFileSync(fonte, JSON.stringify(fixture), "utf-8");

  const primeira = gerar({ fontePath: fonte, saidaPath: saida, escrever: true });
  assert.equal(primeira.escrito, true, "a primeira geração (arquivo ainda não existe) deveria escrever");
  const mtimeAntes = statSync(saida).mtimeMs;

  const segunda = gerar({ fontePath: fonte, saidaPath: saida, escrever: true });
  assert.equal(segunda.escrito, false, "regenerar a mesma fonte sem mudança não deveria escrever de novo");
  assert.equal(statSync(saida).mtimeMs, mtimeAntes, "mtime do catálogo mudou mesmo sem nenhuma alteração de conteúdo");
  assert.equal(readFileSync(saida, "utf-8"), primeira.texto, "o conteúdo continua sendo exatamente o gerado na primeira vez");
});

test("gerar (fonte real): regenerar duas vezes seguidas não reescreve o catálogo já em dia (mtime preservado)", () => {
  const primeira = gerar({ escrever: false });
  writeFileSync(CATALOGO_REAL_PATH, primeira.texto, "utf-8");
  const mtimeAntes = statSync(CATALOGO_REAL_PATH).mtimeMs;

  const resultado = gerar({ escrever: true });
  assert.equal(resultado.escrito, false, "o catálogo real já estava em dia com a fonte — gerar() não deveria reescrevê-lo");
  assert.equal(statSync(CATALOGO_REAL_PATH).mtimeMs, mtimeAntes, "mtime do catálogo real mudou sem necessidade");
});

test("gerar (fonte real): cobre exatamente Língua Portuguesa e Matemática nas três etapas do piloto, nunca Ideb/N/P/meta", () => {
  const { catalogo } = gerar({ escrever: false });
  const chaves = catalogo.escalas.map((e) => `${e.etapa}/${e.componente}`).sort();
  assert.deepEqual(chaves, ["anosFinais/lp", "anosFinais/mt", "anosIniciais/lp", "anosIniciais/mt", "ensinoMedio/lp", "ensinoMedio/mt"]);
});

test("gerar (fonte real): proveniência da publicação está presente e o hash é um SHA-256 bem formado", () => {
  const { catalogo } = gerar({ escrever: false });
  assert.equal(catalogo.fonte.hashSha256, "9b45fbf06e8533357ece8cc5ca2df4363d7f2bcb8169291e11353b5b0bdf74c8");
  assert.match(catalogo.fonte.url, /^https:\/\/([a-z0-9-]+\.)*inep\.gov\.br\//);
  assert.ok(catalogo.fonte.titulo.length > 0);
  assert.ok(catalogo.fonte.versaoPublicacao.length > 0);
});

test("gerar (fonte real): edições documentadas por etapa incluem 2025, e diferem entre Ensino Médio e as demais etapas", () => {
  const { catalogo } = gerar({ escrever: false });
  const edicoesPorChave = Object.fromEntries(catalogo.escalas.map((e) => [`${e.etapa}/${e.componente}`, e.edicoesAssociadas]));

  const anosOitoBienios2005a2025 = ["2005", "2007", "2009", "2011", "2013", "2015", "2017", "2019", "2021", "2023", "2025"];
  assert.deepEqual(edicoesPorChave["anosIniciais/lp"], anosOitoBienios2005a2025);
  assert.deepEqual(edicoesPorChave["anosIniciais/mt"], anosOitoBienios2005a2025);
  assert.deepEqual(edicoesPorChave["anosFinais/lp"], anosOitoBienios2005a2025);
  assert.deepEqual(edicoesPorChave["anosFinais/mt"], anosOitoBienios2005a2025);

  // Ideb por escola do Ensino Médio só existe a partir de 2017 (ver EDICOES_ENSINO_MEDIO em
  // scripts/saeb/lib/sources.mjs) — a lista de edições associadas reflete essa diferença real.
  const ensinoMedio2017a2025 = ["2017", "2019", "2021", "2023", "2025"];
  assert.deepEqual(edicoesPorChave["ensinoMedio/lp"], ensinoMedio2017a2025);
  assert.deepEqual(edicoesPorChave["ensinoMedio/mt"], ensinoMedio2017a2025);
});

test("gerar (fonte real): o Nível 0 é tabulado apenas nas duas escalas de 5º ano — nas demais, é implícito de nota de rodapé", () => {
  // Achado da revisão técnica final: ao contrário dos Quadros 3, 4, 5 e 6 (9º ano e Ensino Médio),
  // que rotulam a coluna "NÍVEL*" com um asterisco e descrevem o Nível 0 só numa nota de rodapé no
  // fim do quadro, os Quadros 1 e 2 (5º ano) do mesmo PDF oficial rotulam a coluna apenas "NÍVEL"
  // (sem asterisco) e apresentam "Nível 0" como uma linha normal da própria tabela, com sua própria
  // descrição — conferido diretamente no texto extraído do PDF nesta rodada. Um nível genuinamente
  // tabelado não pode ficar marcado como se fosse implícito de nota de rodapé.
  const { catalogo } = gerar({ escrever: false });
  const tabuladoEsperado = {
    "anosIniciais/lp": true,
    "anosIniciais/mt": true,
    "anosFinais/lp": false,
    "anosFinais/mt": false,
    "ensinoMedio/lp": false,
    "ensinoMedio/mt": false,
  };
  for (const escala of catalogo.escalas) {
    const chave = `${escala.etapa}/${escala.componente}`;
    const nivel0 = escala.niveis.find((n) => n.nivel === 0);
    assert.equal(nivel0.tabulado, tabuladoEsperado[chave], `${chave}: nível 0 tabulado deveria ser ${tabuladoEsperado[chave]}`);
    assert.equal(nivel0.origemNome, tabuladoEsperado[chave] ? "quadro" : "nota_rodape", `${chave}: origemNome do nível 0`);
    assert.equal(nivel0.nomeNivel, tabuladoEsperado[chave] ? "Nível 0" : "Abaixo do Nível 1", `${chave}: nomeNivel do nível 0`);
  }
});

// ---- Validação estrutural (níveis, escopo, continuidade) ----

test("gerar: rejeita hash SHA-256 malformado", () => {
  const fixture = fixtureValida();
  fixture.fonte.hashSha256 = "não-é-um-hash";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita lacuna entre as fronteiras de dois níveis consecutivos", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].limiteSuperior = 290; // nível 1 termina em 290, nível 2 começa em 300 — lacuna de 290 a 300
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita sobreposição entre as fronteiras de dois níveis consecutivos", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[2].limiteInferior = 280; // nível 2 começa em 280, mas o nível 1 só termina em 300 — sobreposição
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita numeração de nível não contínua a partir de 0", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[0].nivel = 5;
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita nível mais alto que não fica aberto no topo", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[2].limiteSuperior = 500;
  fixture.escalas[0].niveis[2].operadorSuperior = "<";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita nível mais baixo que não fica aberto embaixo", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[0].limiteInferior = 0;
  fixture.escalas[0].niveis[0].operadorInferior = ">=";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita um nível de nota de rodapé marcado como tabulado — nunca inventar um nível tabelado a partir de uma nota", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[0].tabulado = true;
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita origemNome 'quadro' com tabulado false — a equivalência entre os dois campos precisa valer nos dois sentidos", () => {
  // niveis[1] tem origemNome "quadro" por padrão (ver niveisValidos()) — um nível que veio de um
  // quadro tabelado do PDF nunca pode ficar marcado como se fosse implícito/não tabulado.
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].tabulado = false;
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita escopo incompleto — falta uma escala do escopo de seis (ensinoMedio/mt)", () => {
  const fixture = fixtureValida();
  fixture.escalas = fixture.escalas.filter((e) => !(e.etapa === "ensinoMedio" && e.componente === "mt"));
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita escopo com uma etapa inteira ausente (só anosFinais, faltando anosIniciais e ensinoMedio)", () => {
  const fixture = fixtureValida();
  fixture.escalas = fixture.escalas.filter((e) => e.etapa === "anosFinais");
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita etapa não registrada na lista de edições por etapa", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].etapa = "etapaInventada";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita nível sem descrição oficial", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].descricaoOficial = "";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

// ---- Validação semântica endurecida (operadores, tipos, páginas, URL) ----

test("gerar: rejeita operadorInferior '>' — só '>=' é aceito quando o limite é numérico", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].operadorInferior = ">";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita operadorSuperior '<=' — só '<' é aceito quando o limite é numérico", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].operadorSuperior = "<=";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita operador presente quando o limite correspondente é nulo", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[2].operadorSuperior = "<"; // nível 2 (o mais alto) tem limiteSuperior null
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita limite numérico sem o operador exigido (operador ausente/nulo)", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].operadorInferior = null; // limiteInferior 200 (não nulo) exige ">="
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita limiteInferior NaN", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].limiteInferior = NaN;
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita limiteSuperior Infinity", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].limiteSuperior = Infinity;
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita página de PDF zero", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].paginasPdf = [0];
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita página de PDF negativa", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].paginasPdf = [-1];
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita página de PDF decimal", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].paginasPdf = [1.5];
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita página de PDF acima do total de páginas da fonte", () => {
  const fixture = fixtureValida(); // fonte.totalPaginasPdf = 3
  fixture.escalas[0].niveis[1].paginasPdf = [4];
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita paginasImpressas vazia", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].paginasImpressas = [];
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita paginasImpressas com valor não inteiro positivo", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].paginasImpressas = [0];
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita nomeNivel vazio", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].nomeNivel = "";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita nomeNivel ausente (apenas espaços)", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].nomeNivel = "   ";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita 'tabulado' com tipo incorreto (string em vez de booleano)", () => {
  const fixture = fixtureValida();
  fixture.escalas[0].niveis[1].tabulado = "true";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita descricaoOficial ausente", () => {
  const fixture = fixtureValida();
  delete fixture.escalas[0].niveis[1].descricaoOficial;
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita totalPaginasPdf não inteiro positivo", () => {
  const fixture = fixtureValida();
  fixture.fonte.totalPaginasPdf = 0;
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita título, órgão ou versão da fonte vazios", () => {
  for (const campo of ["titulo", "orgao", "versaoPublicacao"]) {
    const fixture = fixtureValida();
    fixture.fonte[campo] = "";
    assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError, `deveria rejeitar fonte.${campo} vazio`);
  }
});

test("gerar: rejeita etapaLabelOficial, quadro, tituloOficial ou fonteInternaCitada vazios ou só com espaços", () => {
  // Parametrizado sobre os quatro campos de metadado da escala × duas formas de "vazio": string
  // vazia e string só com espaços — "   " não pode passar como texto válido em nenhum dos quatro.
  const campos = ["etapaLabelOficial", "quadro", "tituloOficial", "fonteInternaCitada"];
  const valoresVazios = ["", "   "];
  for (const campo of campos) {
    for (const valorVazio of valoresVazios) {
      const fixture = fixtureValida();
      fixture.escalas[0][campo] = valorVazio;
      assert.throws(
        () => gerarComFixture(fixture),
        EscalasGeracaoError,
        `deveria rejeitar escalas[0].${campo} = ${JSON.stringify(valorVazio)}`,
      );
    }
  }
});

test("gerar: rejeita URL da fonte que não é HTTPS", () => {
  const fixture = fixtureValida();
  fixture.fonte.url = "http://download.inep.gov.br/publicacoes/teste/escala-teste.pdf";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita URL da fonte fora do domínio oficial do Inep", () => {
  const fixture = fixtureValida();
  fixture.fonte.url = "https://example.com/escalas_de_proficiencia_do_saeb.pdf";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar: rejeita um domínio que só termina com as mesmas letras de inep.gov.br sem ser um subdomínio real", () => {
  // "notinep.gov.br" contém "inep.gov.br" como sufixo de string, mas não é um subdomínio de
  // inep.gov.br — a checagem tem que comparar o hostname todo, não fazer um "includes" ingênuo.
  const fixture = fixtureValida();
  fixture.fonte.url = "https://notinep.gov.br/escala.pdf";
  assert.throws(() => gerarComFixture(fixture), EscalasGeracaoError);
});

test("gerar (fonte real): a URL da fonte é HTTPS e pertence ao domínio oficial do Inep", () => {
  const { catalogo } = gerar({ escrever: false });
  const url = new URL(catalogo.fonte.url);
  assert.equal(url.protocol, "https:");
  assert.ok(url.hostname === "inep.gov.br" || url.hostname.endsWith(".inep.gov.br"), `host inesperado: ${url.hostname}`);
});

// ---- Fronteiras oficiais completas — verificação independente, sem derivar do catálogo/resolver ----
// Valores conferidos diretamente contra o PDF (ver relatório do piloto), nunca recalculados a
// partir da implementação sob teste: cada escala do SAEB usa incrementos uniformes de 25 pontos,
// com o nível mais baixo aberto embaixo e o mais alto aberto em cima.

const FRONTEIRAS_OFICIAIS_ANOS_INICIAIS_LP = [
  { nivel: 0, limiteInferior: null, limiteSuperior: 125 },
  { nivel: 1, limiteInferior: 125, limiteSuperior: 150 },
  { nivel: 2, limiteInferior: 150, limiteSuperior: 175 },
  { nivel: 3, limiteInferior: 175, limiteSuperior: 200 },
  { nivel: 4, limiteInferior: 200, limiteSuperior: 225 },
  { nivel: 5, limiteInferior: 225, limiteSuperior: 250 },
  { nivel: 6, limiteInferior: 250, limiteSuperior: 275 },
  { nivel: 7, limiteInferior: 275, limiteSuperior: 300 },
  { nivel: 8, limiteInferior: 300, limiteSuperior: 325 },
  { nivel: 9, limiteInferior: 325, limiteSuperior: null },
];

const FRONTEIRAS_OFICIAIS_ANOS_INICIAIS_MT = [
  { nivel: 0, limiteInferior: null, limiteSuperior: 125 },
  { nivel: 1, limiteInferior: 125, limiteSuperior: 150 },
  { nivel: 2, limiteInferior: 150, limiteSuperior: 175 },
  { nivel: 3, limiteInferior: 175, limiteSuperior: 200 },
  { nivel: 4, limiteInferior: 200, limiteSuperior: 225 },
  { nivel: 5, limiteInferior: 225, limiteSuperior: 250 },
  { nivel: 6, limiteInferior: 250, limiteSuperior: 275 },
  { nivel: 7, limiteInferior: 275, limiteSuperior: 300 },
  { nivel: 8, limiteInferior: 300, limiteSuperior: 325 },
  { nivel: 9, limiteInferior: 325, limiteSuperior: 350 },
  { nivel: 10, limiteInferior: 350, limiteSuperior: null },
];

const FRONTEIRAS_OFICIAIS_ANOS_FINAIS_LP = [
  { nivel: 0, limiteInferior: null, limiteSuperior: 200 },
  { nivel: 1, limiteInferior: 200, limiteSuperior: 225 },
  { nivel: 2, limiteInferior: 225, limiteSuperior: 250 },
  { nivel: 3, limiteInferior: 250, limiteSuperior: 275 },
  { nivel: 4, limiteInferior: 275, limiteSuperior: 300 },
  { nivel: 5, limiteInferior: 300, limiteSuperior: 325 },
  { nivel: 6, limiteInferior: 325, limiteSuperior: 350 },
  { nivel: 7, limiteInferior: 350, limiteSuperior: 375 },
  { nivel: 8, limiteInferior: 375, limiteSuperior: null },
];

const FRONTEIRAS_OFICIAIS_ANOS_FINAIS_MT = [
  { nivel: 0, limiteInferior: null, limiteSuperior: 200 },
  { nivel: 1, limiteInferior: 200, limiteSuperior: 225 },
  { nivel: 2, limiteInferior: 225, limiteSuperior: 250 },
  { nivel: 3, limiteInferior: 250, limiteSuperior: 275 },
  { nivel: 4, limiteInferior: 275, limiteSuperior: 300 },
  { nivel: 5, limiteInferior: 300, limiteSuperior: 325 },
  { nivel: 6, limiteInferior: 325, limiteSuperior: 350 },
  { nivel: 7, limiteInferior: 350, limiteSuperior: 375 },
  { nivel: 8, limiteInferior: 375, limiteSuperior: 400 },
  { nivel: 9, limiteInferior: 400, limiteSuperior: null },
];

const FRONTEIRAS_OFICIAIS_ENSINO_MEDIO_LP = [
  { nivel: 0, limiteInferior: null, limiteSuperior: 225 },
  { nivel: 1, limiteInferior: 225, limiteSuperior: 250 },
  { nivel: 2, limiteInferior: 250, limiteSuperior: 275 },
  { nivel: 3, limiteInferior: 275, limiteSuperior: 300 },
  { nivel: 4, limiteInferior: 300, limiteSuperior: 325 },
  { nivel: 5, limiteInferior: 325, limiteSuperior: 350 },
  { nivel: 6, limiteInferior: 350, limiteSuperior: 375 },
  { nivel: 7, limiteInferior: 375, limiteSuperior: 400 },
  { nivel: 8, limiteInferior: 400, limiteSuperior: null },
];

const FRONTEIRAS_OFICIAIS_ENSINO_MEDIO_MT = [
  { nivel: 0, limiteInferior: null, limiteSuperior: 225 },
  { nivel: 1, limiteInferior: 225, limiteSuperior: 250 },
  { nivel: 2, limiteInferior: 250, limiteSuperior: 275 },
  { nivel: 3, limiteInferior: 275, limiteSuperior: 300 },
  { nivel: 4, limiteInferior: 300, limiteSuperior: 325 },
  { nivel: 5, limiteInferior: 325, limiteSuperior: 350 },
  { nivel: 6, limiteInferior: 350, limiteSuperior: 375 },
  { nivel: 7, limiteInferior: 375, limiteSuperior: 400 },
  { nivel: 8, limiteInferior: 400, limiteSuperior: 425 },
  { nivel: 9, limiteInferior: 425, limiteSuperior: 450 },
  { nivel: 10, limiteInferior: 450, limiteSuperior: null },
];

function extrairFronteiras(escala) {
  return [...escala.niveis]
    .sort((a, b) => a.nivel - b.nivel)
    .map((n) => ({ nivel: n.nivel, limiteInferior: n.limiteInferior, limiteSuperior: n.limiteSuperior }));
}

function buscarEscalaReal(catalogo, etapa, componente) {
  const escala = catalogo.escalas.find((e) => e.etapa === etapa && e.componente === componente);
  assert.ok(escala, `escala ${etapa}/${componente} não encontrada no catálogo`);
  return escala;
}

test("fronteiras oficiais completas — 5º ano / Anos Iniciais, Língua Portuguesa (abaixo de 125; 125 a 325 em passos de 25; Nível 9 a partir de 325)", () => {
  const { catalogo } = gerar({ escrever: false });
  assert.deepEqual(extrairFronteiras(buscarEscalaReal(catalogo, "anosIniciais", "lp")), FRONTEIRAS_OFICIAIS_ANOS_INICIAIS_LP);
});

test("fronteiras oficiais completas — 5º ano / Anos Iniciais, Matemática (abaixo de 125; 125 a 350 em passos de 25; Nível 10 a partir de 350)", () => {
  const { catalogo } = gerar({ escrever: false });
  assert.deepEqual(extrairFronteiras(buscarEscalaReal(catalogo, "anosIniciais", "mt")), FRONTEIRAS_OFICIAIS_ANOS_INICIAIS_MT);
});

test("fronteiras oficiais completas — 9º ano / Anos Finais, Língua Portuguesa (abaixo de 200; 200 a 375 em passos de 25; Nível 8 a partir de 375)", () => {
  const { catalogo } = gerar({ escrever: false });
  assert.deepEqual(extrairFronteiras(buscarEscalaReal(catalogo, "anosFinais", "lp")), FRONTEIRAS_OFICIAIS_ANOS_FINAIS_LP);
});

test("fronteiras oficiais completas — 9º ano / Anos Finais, Matemática (abaixo de 200; 200 a 400 em passos de 25; Nível 9 a partir de 400)", () => {
  const { catalogo } = gerar({ escrever: false });
  assert.deepEqual(extrairFronteiras(buscarEscalaReal(catalogo, "anosFinais", "mt")), FRONTEIRAS_OFICIAIS_ANOS_FINAIS_MT);
});

test("fronteiras oficiais completas — Ensino Médio, Língua Portuguesa (abaixo de 225; 225 a 400 em passos de 25; Nível 8 a partir de 400)", () => {
  const { catalogo } = gerar({ escrever: false });
  assert.deepEqual(extrairFronteiras(buscarEscalaReal(catalogo, "ensinoMedio", "lp")), FRONTEIRAS_OFICIAIS_ENSINO_MEDIO_LP);
});

test("fronteiras oficiais completas — Ensino Médio, Matemática (abaixo de 225; 225 a 450 em passos de 25; Nível 10 a partir de 450)", () => {
  const { catalogo } = gerar({ escrever: false });
  assert.deepEqual(extrairFronteiras(buscarEscalaReal(catalogo, "ensinoMedio", "mt")), FRONTEIRAS_OFICIAIS_ENSINO_MEDIO_MT);
});

// ---- verificar(): divergência entre fonte e catálogo versionado ----

test("verificar: o catálogo real, já versionado, está em dia com a fonte real", () => {
  assert.doesNotThrow(() => verificar());
});

test("verificar: não escreve na working tree ao validar o catálogo real", () => {
  const conteudoAntes = readFileSync(CATALOGO_REAL_PATH, "utf-8");
  const mtimeAntes = statSync(CATALOGO_REAL_PATH).mtimeMs;

  verificar();

  assert.equal(readFileSync(CATALOGO_REAL_PATH, "utf-8"), conteudoAntes, "verificar() alterou o conteúdo do catálogo versionado");
  assert.equal(statSync(CATALOGO_REAL_PATH).mtimeMs, mtimeAntes, "verificar() tocou o arquivo do catálogo versionado (mtime mudou)");
});

test("verificar: detecta catálogo ausente (nunca gerado)", () => {
  const fonte = join(dir, "fonte.json");
  writeFileSync(fonte, JSON.stringify(fixtureValida()), "utf-8");
  const saida = join(dir, "escalas-lp-mt.json"); // nunca escrito
  assert.throws(() => verificar({ fontePath: fonte, saidaPath: saida }), EscalasGeracaoError);
});

test("verificar: detecta catálogo editado manualmente (bytes divergem, embora a fonte não tenha mudado)", () => {
  const fixture = fixtureValida();
  const fonte = join(dir, "fonte.json");
  const saida = join(dir, "escalas-lp-mt.json");
  writeFileSync(fonte, JSON.stringify(fixture), "utf-8");
  gerar({ fontePath: fonte, saidaPath: saida, escrever: true });

  // Simula uma edição manual do artefato gerado: acrescenta um espaço final.
  const gerado = readFileSync(saida, "utf-8");
  writeFileSync(saida, `${gerado} `, "utf-8");

  assert.throws(() => verificar({ fontePath: fonte, saidaPath: saida }), EscalasGeracaoError);
});

test("verificar: detecta divergência de newline (CRLF em vez de LF) mesmo com o mesmo conteúdo textual", () => {
  const fixture = fixtureValida();
  const fonte = join(dir, "fonte.json");
  const saida = join(dir, "escalas-lp-mt.json");
  writeFileSync(fonte, JSON.stringify(fixture), "utf-8");
  gerar({ fontePath: fonte, saidaPath: saida, escrever: true });

  const gerado = readFileSync(saida, "utf-8");
  writeFileSync(saida, gerado.replace(/\n/g, "\r\n"), "utf-8");

  assert.throws(() => verificar({ fontePath: fonte, saidaPath: saida }), EscalasGeracaoError);
});

test("verificar: detecta fonte alterada sem que o catálogo tenha sido regenerado", () => {
  const fonte = join(dir, "fonte.json");
  const saida = join(dir, "escalas-lp-mt.json");

  const fixtureA = fixtureValida();
  writeFileSync(fonte, JSON.stringify(fixtureA), "utf-8");
  gerar({ fontePath: fonte, saidaPath: saida, escrever: true }); // catálogo gravado a partir da fixture A

  // A fonte muda (nova descrição oficial), mas o catálogo em `saida` continua sendo o da fixture A.
  const fixtureB = fixtureValida();
  fixtureB.escalas[0].niveis[1].descricaoOficial = "Descrição totalmente diferente, a fonte mudou.";
  writeFileSync(fonte, JSON.stringify(fixtureB), "utf-8");

  assert.throws(() => verificar({ fontePath: fonte, saidaPath: saida }), EscalasGeracaoError);
});

test("verificar: passa quando o catálogo é regenerado corretamente após a fonte mudar", () => {
  const fonte = join(dir, "fonte.json");
  const saida = join(dir, "escalas-lp-mt.json");

  writeFileSync(fonte, JSON.stringify(fixtureValida()), "utf-8");
  gerar({ fontePath: fonte, saidaPath: saida, escrever: true });

  const fixtureB = fixtureValida();
  fixtureB.escalas[0].niveis[1].descricaoOficial = "Descrição totalmente diferente, a fonte mudou.";
  writeFileSync(fonte, JSON.stringify(fixtureB), "utf-8");
  gerar({ fontePath: fonte, saidaPath: saida, escrever: true }); // regenerado corretamente

  assert.doesNotThrow(() => verificar({ fontePath: fonte, saidaPath: saida }));
});
