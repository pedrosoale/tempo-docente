// Testes do gerador determinístico do catálogo de descritores da matriz de referência tradicional
// (2001) do Saeb (scripts/saeb-descritores/gerar.mjs). Nenhuma rede, nenhum PDF — só o arquivo-fonte
// já verificado (data/saeb-descritores/source/official-inep-matriz-lp-mt-2001.json) e fixtures
// pequenas escritas em arquivos temporários para os casos de divergência estrutural/semântica.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createHash } from "node:crypto";
import { DescritoresGeracaoError, calcularHashSha256, gerar, verificar, verificarHashPdfLocal } from "../scripts/saeb-descritores/gerar.mjs";

const CATALOGO_REAL_PATH = fileURLToPath(new URL("../data/saeb-descritores/matriz-lp-mt-2001.json", import.meta.url));

const ETAPAS_PILOTO = ["anosIniciais", "anosFinais", "ensinoMedio"];
const COMPONENTES_PILOTO = ["lp", "mt"];

const CONTAGEM_ESPERADA_REAL = {
  "anosIniciais/lp": 15,
  "anosFinais/lp": 21,
  "ensinoMedio/lp": 21,
  "anosIniciais/mt": 28,
  "anosFinais/mt": 37,
  "ensinoMedio/mt": 35,
};

// Cópia independente das tabelas oficiais em gerar.mjs — deliberadamente reescrita aqui (não
// importada) para que este arquivo não valide o gerador contra os próprios dados que deveria estar
// testando. Mesmo padrão de tests/sitemap.test.mjs, que lê os datasets brutos em vez de importar o
// mapeamento da implementação.
const GRUPOS_OFICIAIS_POR_COMPONENTE = {
  lp: [
    ["I", "Procedimentos de leitura"],
    ["II", "Implicações do suporte, do gênero e/ou do enunciador na compreensão do texto"],
    ["III", "Relação entre textos"],
    ["IV", "Coerência e coesão no processamento do texto"],
    ["V", "Relações entre recursos expressivos e efeitos de sentido"],
    ["VI", "Variação linguística"],
  ],
  mt: [
    ["I", "Espaço e Forma"],
    ["II", "Grandezas e Medidas"],
    ["III", "Números e Operações/Álgebra e Funções"],
    ["IV", "Tratamento da Informação"],
  ],
};

function faixaDescritores(inicio, fim) {
  const codigos = [];
  for (let i = inicio; i <= fim; i += 1) codigos.push(`D${i}`);
  return codigos;
}

// Conjunto EXATO de códigos por grupo, reescrito por extenso a partir do quadro de distribuição
// oficial (nunca calculado a partir de gerar.mjs ou do arquivo-fonte) — a numeração de Língua
// Portuguesa não segue a ordem dos tópicos (ex.: o tópico I contém D1, D3, D4, D6, D11), por isso é
// listada por extenso; a de Matemática segue a ordem dos temas, por isso usa faixaDescritores.
const CODIGOS_POR_GRUPO_ESPERADO = {
  "anosIniciais/lp": { I: ["D1", "D3", "D4", "D6", "D11"], II: ["D5", "D9"], III: ["D15"], IV: ["D2", "D7", "D8", "D12"], V: ["D13", "D14"], VI: ["D10"] },
  "anosFinais/lp": { I: ["D1", "D3", "D4", "D6", "D14"], II: ["D5", "D12"], III: ["D20", "D21"], IV: ["D2", "D7", "D8", "D9", "D10", "D11", "D15"], V: ["D16", "D17", "D18", "D19"], VI: ["D13"] },
  "ensinoMedio/lp": { I: ["D1", "D3", "D4", "D6", "D14"], II: ["D5", "D12"], III: ["D20", "D21"], IV: ["D2", "D7", "D8", "D9", "D10", "D11", "D15"], V: ["D16", "D17", "D18", "D19"], VI: ["D13"] },
  "anosIniciais/mt": { I: faixaDescritores(1, 5), II: faixaDescritores(6, 12), III: faixaDescritores(13, 26), IV: faixaDescritores(27, 28) },
  "anosFinais/mt": { I: faixaDescritores(1, 11), II: faixaDescritores(12, 15), III: faixaDescritores(16, 35), IV: faixaDescritores(36, 37) },
  "ensinoMedio/mt": { I: faixaDescritores(1, 10), II: faixaDescritores(11, 13), III: faixaDescritores(14, 33), IV: faixaDescritores(34, 35) },
};

function descritor(overrides) {
  return {
    codigo: "D1",
    texto: "Descritor de teste.",
    paginasPdf: [1],
    paginasImpressas: [1],
    ...overrides,
  };
}

/** Uma matriz de teste válida, com os grupos oficiais do componente e, em cada um, exatamente o
 * conjunto de códigos documentado para aquele recorte (CODIGOS_POR_GRUPO_ESPERADO) — não só a
 * quantidade certa, mas os códigos certos, na posição certa. Reproduz a estrutura real porque a
 * validação do gerador agora exige isso de qualquer fixture, não só da fonte real. */
function matrizValida(etapa, componente, overrides = {}) {
  const chave = `${etapa}/${componente}`;
  const codigosPorGrupo = CODIGOS_POR_GRUPO_ESPERADO[chave];
  const grupos = GRUPOS_OFICIAIS_POR_COMPONENTE[componente].map(([numero, nome]) => ({
    numero,
    nome,
    descritores: codigosPorGrupo[numero].map((codigo) => descritor({ codigo })),
  }));

  return {
    etapa,
    etapaLabelOficial: `Etapa de teste — ${etapa}`,
    componente,
    quadro: `Quadro de teste — ${etapa}/${componente}`,
    tituloOficial: `Matriz de teste — ${etapa}/${componente}`,
    fonteInternaCitada: "Fonte: teste.",
    rotuloAgrupamento: componente === "lp" ? "topico" : "tema",
    grupos,
    ...overrides,
  };
}

function fonteValida(overrides = {}) {
  return {
    titulo: "Publicação de teste",
    orgao: "Órgão de teste",
    url: "https://download.inep.gov.br/publicacoes/teste/matriz-teste.pdf",
    versaoPublicacao: "Edição de teste",
    hashSha256: "a".repeat(64),
    totalPaginasPdf: 3,
    ...overrides,
  };
}

function fixtureValida() {
  return {
    fontes: { lp: fonteValida(), mt: fonteValida() },
    matrizes: ETAPAS_PILOTO.flatMap((etapa) => COMPONENTES_PILOTO.map((componente) => matrizValida(etapa, componente))),
  };
}

let dir;
test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "saeb-descritores-teste-"));
});
test.afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function gerarComFixture(fixture, opcoes = {}) {
  const caminho = join(dir, "fonte.json");
  writeFileSync(caminho, JSON.stringify(fixture), "utf-8");
  return gerar({ fontePath: caminho, escrever: opcoes.escrever ?? false, saidaPath: opcoes.saidaPath });
}

test("gerar: fixture estruturalmente válida produz um catálogo com schema, piloto e as seis matrizes (3 etapas × 2 componentes)", () => {
  const { catalogo } = gerarComFixture(fixtureValida());
  assert.equal(catalogo.schema, "saeb-descritores-piloto/1");
  assert.equal(catalogo.piloto.matrizAbrangida, "tradicional-2001");
  assert.deepEqual(
    catalogo.matrizes.map((m) => `${m.etapa}/${m.componente}`).sort(),
    ["anosFinais/lp", "anosFinais/mt", "anosIniciais/lp", "anosIniciais/mt", "ensinoMedio/lp", "ensinoMedio/mt"],
  );
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
  const saida = join(dir, "matriz-lp-mt-2001.json");
  writeFileSync(fonte, JSON.stringify(fixture), "utf-8");

  const primeira = gerar({ fontePath: fonte, saidaPath: saida, escrever: true });
  assert.equal(primeira.escrito, true);
  const mtimeAntes = statSync(saida).mtimeMs;

  const segunda = gerar({ fontePath: fonte, saidaPath: saida, escrever: true });
  assert.equal(segunda.escrito, false);
  assert.equal(statSync(saida).mtimeMs, mtimeAntes);
  assert.equal(readFileSync(saida, "utf-8"), primeira.texto);
});

test("gerar (fonte real): regenerar duas vezes seguidas com a fonte real não reescreve quando já está em dia (mtime preservado) — grava só em diretório temporário, nunca no catálogo versionado", () => {
  const saida = join(dir, "matriz-lp-mt-2001.json");
  // fontePath fica no valor padrão (a fonte real do projeto); só saidaPath aponta para o tmpdir —
  // isso testa o comportamento de "não reescrever quando em dia" com dados reais sem nunca tocar em
  // data/saeb-descritores/matriz-lp-mt-2001.json.
  const primeira = gerar({ saidaPath: saida, escrever: true });
  assert.equal(primeira.escrito, true, "a primeira geração no tmpdir (arquivo ainda não existe) deveria escrever");
  const mtimeAntes = statSync(saida).mtimeMs;

  const segunda = gerar({ saidaPath: saida, escrever: true });
  assert.equal(segunda.escrito, false, "regenerar a mesma fonte real sem mudança não deveria escrever de novo");
  assert.equal(statSync(saida).mtimeMs, mtimeAntes);
  assert.equal(readFileSync(saida, "utf-8"), primeira.texto);
});

test("gerar (fonte real): cobre exatamente Língua Portuguesa e Matemática nas três etapas do piloto", () => {
  const { catalogo } = gerar({ escrever: false });
  const chaves = catalogo.matrizes.map((m) => `${m.etapa}/${m.componente}`).sort();
  assert.deepEqual(chaves, ["anosFinais/lp", "anosFinais/mt", "anosIniciais/lp", "anosIniciais/mt", "ensinoMedio/lp", "ensinoMedio/mt"]);
});

test("gerar (fonte real): contagens exatas de descritores por etapa/componente, conferidas contra os quadros de distribuição oficiais", () => {
  const { catalogo } = gerar({ escrever: false });
  for (const [chave, esperado] of Object.entries(CONTAGEM_ESPERADA_REAL)) {
    const [etapa, componente] = chave.split("/");
    const matriz = catalogo.matrizes.find((m) => m.etapa === etapa && m.componente === componente);
    assert.ok(matriz, `matriz ${chave} não encontrada`);
    const total = matriz.grupos.reduce((soma, grupo) => soma + grupo.descritores.length, 0);
    assert.equal(total, esperado, `${chave}: esperado ${esperado} descritores, encontrado ${total}`);
  }
});

test("gerar (fonte real): a 3ª série do Ensino Médio de Língua Portuguesa repete exatamente o conjunto de descritores do 9º ano (mesmos códigos e mesmos textos)", () => {
  // Achado da transcrição: a matriz tradicional de LP usa o MESMO conjunto de descritores (D1–D21,
  // mesmo texto oficial) para o 9º ano do Ensino Fundamental e para a 3ª série do Ensino Médio —
  // conferido visualmente contra os Quadros 3 e 5 do PDF oficial. Um teste de regressão explícito
  // evita que uma futura transcrição "corrija" isso por engano, achando que é uma duplicata.
  const { catalogo } = gerar({ escrever: false });
  const nono = catalogo.matrizes.find((m) => m.etapa === "anosFinais" && m.componente === "lp");
  const medio = catalogo.matrizes.find((m) => m.etapa === "ensinoMedio" && m.componente === "lp");
  const textosPorCodigo = (matriz) => Object.fromEntries(matriz.grupos.flatMap((g) => g.descritores).map((d) => [d.codigo, d.texto]));
  assert.deepEqual(textosPorCodigo(medio), textosPorCodigo(nono));
});

test("gerar (fonte real): cada descritor tem código único, densamente numerado a partir de D1, dentro da sua matriz", () => {
  const { catalogo } = gerar({ escrever: false });
  for (const matriz of catalogo.matrizes) {
    const codigos = matriz.grupos.flatMap((g) => g.descritores.map((d) => d.codigo));
    assert.equal(new Set(codigos).size, codigos.length, `${matriz.etapa}/${matriz.componente}: código duplicado`);
    const numeros = codigos.map((c) => Number(c.slice(1))).sort((a, b) => a - b);
    assert.deepEqual(numeros, Array.from({ length: numeros.length }, (_, i) => i + 1), `${matriz.etapa}/${matriz.componente}: numeração não densa`);
  }
});

test("gerar (fonte real): nenhum código ou texto de descritor vazio", () => {
  const { catalogo } = gerar({ escrever: false });
  for (const matriz of catalogo.matrizes) {
    for (const grupo of matriz.grupos) {
      for (const descritor of grupo.descritores) {
        assert.ok(descritor.codigo.trim().length > 0);
        assert.ok(descritor.texto.trim().length > 0);
      }
    }
  }
});

test("gerar (fonte real): todo grupo tem número e nome de tópico/tema não vazios", () => {
  const { catalogo } = gerar({ escrever: false });
  for (const matriz of catalogo.matrizes) {
    for (const grupo of matriz.grupos) {
      assert.ok(grupo.numero.trim().length > 0);
      assert.ok(grupo.nome.trim().length > 0);
    }
  }
});

test("gerar (fonte real): Língua Portuguesa rotula o agrupamento como 'topico' e Matemática como 'tema'", () => {
  const { catalogo } = gerar({ escrever: false });
  for (const matriz of catalogo.matrizes) {
    assert.equal(matriz.rotuloAgrupamento, matriz.componente === "lp" ? "topico" : "tema");
  }
});

test("gerar (fonte real): proveniência de cada componente está presente, com hash SHA-256 bem formado e URL oficial", () => {
  const { catalogo } = gerar({ escrever: false });
  for (const componente of COMPONENTES_PILOTO) {
    const fonte = catalogo.fontes[componente];
    assert.match(fonte.hashSha256, /^[0-9a-f]{64}$/);
    const url = new URL(fonte.url);
    assert.equal(url.protocol, "https:");
    assert.ok(url.hostname === "inep.gov.br" || url.hostname.endsWith(".inep.gov.br"), `host inesperado: ${url.hostname}`);
    assert.ok(fonte.titulo.length > 0);
    assert.ok(fonte.versaoPublicacao.length > 0);
    assert.ok(ehInteiroPositivo(fonte.totalPaginasPdf));
  }
});

function ehInteiroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0;
}

test("gerar (fonte real): cada página de PDF citada por um descritor está dentro do total de páginas da publicação", () => {
  const { catalogo } = gerar({ escrever: false });
  for (const matriz of catalogo.matrizes) {
    const totalPaginas = catalogo.fontes[matriz.componente].totalPaginasPdf;
    for (const grupo of matriz.grupos) {
      for (const descritor of grupo.descritores) {
        for (const pagina of descritor.paginasPdf) {
          assert.ok(pagina <= totalPaginas, `${matriz.etapa}/${matriz.componente} ${descritor.codigo}: página ${pagina} > total ${totalPaginas}`);
        }
      }
    }
  }
});

// ---- Validação estrutural/semântica (fixtures) ----

test("gerar: rejeita hash SHA-256 malformado", () => {
  const fixture = fixtureValida();
  fixture.fontes.lp.hashSha256 = "não-é-um-hash";
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita URL da fonte que não é HTTPS", () => {
  const fixture = fixtureValida();
  fixture.fontes.mt.url = "http://download.inep.gov.br/publicacoes/teste/matriz-teste.pdf";
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita URL da fonte fora do domínio oficial do Inep — não é a fonte oficial", () => {
  const fixture = fixtureValida();
  fixture.fontes.lp.url = "https://example.com/matriz.pdf";
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita metadado de fonte ausente para um componente", () => {
  const fixture = fixtureValida();
  delete fixture.fontes.mt;
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita código de descritor fora do vocabulário 'D<dígitos>'", () => {
  const fixture = fixtureValida();
  fixture.matrizes[0].grupos[0].descritores[0].codigo = "X1";
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita código de descritor com zero à esquerda", () => {
  const fixture = fixtureValida();
  fixture.matrizes[0].grupos[0].descritores[0].codigo = "D01";
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita texto de descritor vazio", () => {
  const fixture = fixtureValida();
  fixture.matrizes[0].grupos[0].descritores[0].texto = "   ";
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita código de descritor duplicado dentro da mesma matriz", () => {
  const fixture = fixtureValida();
  const matriz = fixture.matrizes[0];
  matriz.grupos[0].descritores[1].codigo = matriz.grupos[0].descritores[0].codigo;
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita numeração de descritor com lacuna (D1, D3, sem D2)", () => {
  const fixture = fixtureValida();
  const matriz = fixture.matrizes[0];
  matriz.grupos[0].descritores[1].codigo = `D${matriz.grupos[0].descritores.length + 1}`;
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita contagem de descritores diferente da contagem oficial esperada para o recorte", () => {
  const fixture = fixtureValida();
  fixture.matrizes[0].grupos[0].descritores.push(descritor({ codigo: `D${fixture.matrizes[0].grupos[0].descritores.length + 1}` }));
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita grupo sem nome", () => {
  const fixture = fixtureValida();
  fixture.matrizes[0].grupos[0].nome = "";
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita grupo sem descritores", () => {
  const fixture = fixtureValida();
  fixture.matrizes[0].grupos[0].descritores = [];
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita rotuloAgrupamento fora de 'topico'/'tema'", () => {
  const fixture = fixtureValida();
  fixture.matrizes[0].rotuloAgrupamento = "assunto";
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita rotuloAgrupamento tecnicamente válido mas errado para o componente (Língua Portuguesa com 'tema')", () => {
  // matrizes[0] é anosIniciais/lp — "tema" é um valor válido do vocabulário {topico,tema}, mas
  // errado para Língua Portuguesa (a fonte rotula LP como "TÓPICOS"). Antes desta correção, esse
  // valor passava sem erro por estar tecnicamente na lista de rótulos aceitos.
  const fixture = fixtureValida();
  fixture.matrizes[0].rotuloAgrupamento = "tema";
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

// ---- Grupos oficiais (tópicos/temas): rejeita tema inventado e grupo duplicado ----

test("gerar: rejeita tópico/tema inventado (nome não corresponde a nenhum grupo oficial do componente)", () => {
  const fixture = fixtureValida();
  fixture.matrizes[0].grupos[0].nome = "Tópico Inventado Que Não Existe No PDF Oficial";
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita número de grupo oficial associado ao nome errado (numero 'I' com o nome do grupo 'II')", () => {
  const fixture = fixtureValida();
  const matriz = fixture.matrizes[0]; // anosIniciais/lp
  matriz.grupos[0].numero = "II"; // agora "II" aparece com o nome de "Procedimentos de leitura" (grupo I)
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita número de grupo duplicado dentro da mesma matriz", () => {
  const fixture = fixtureValida();
  const matriz = fixture.matrizes[0]; // anosIniciais/lp — grupos[1] é o grupo oficial "II"
  matriz.grupos[1].numero = matriz.grupos[0].numero; // "II" vira "I", duplicando o número "I"
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita grupo oficial faltando (matriz com só 5 dos 6 tópicos oficiais de Língua Portuguesa)", () => {
  const fixture = fixtureValida();
  const matriz = fixture.matrizes[0]; // anosIniciais/lp — 6 grupos oficiais
  matriz.grupos = matriz.grupos.slice(0, 5);
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita grupo oficial repetido em vez de outro grupo oficial (7 grupos em vez de 6, um deles duplicado)", () => {
  const fixture = fixtureValida();
  const matriz = fixture.matrizes[0]; // anosIniciais/lp
  const clone = { ...matriz.grupos[0], descritores: matriz.grupos[0].descritores.map((d) => ({ ...d, codigo: `D${100 + Number(d.codigo.slice(1))}` })) };
  matriz.grupos = [...matriz.grupos, clone];
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita descritor arquivado sob o grupo errado mesmo quando o total da matriz continua correto", () => {
  // Move um descritor do grupo I (5 descritores) para o grupo VI (1 descritor) em anosIniciais/lp:
  // o grupo I fica com 4, o grupo VI fica com 2 — a CONTAGEM total da matriz (15) não muda, então só
  // a validação por grupo pega esse tipo de erro de transcrição.
  const fixture = fixtureValida();
  const matriz = fixture.matrizes[0]; // anosIniciais/lp
  const grupoI = matriz.grupos.find((g) => g.numero === "I");
  const grupoVI = matriz.grupos.find((g) => g.numero === "VI");
  grupoVI.descritores.push(grupoI.descritores.pop());
  assert.equal(matriz.grupos.flatMap((g) => g.descritores).length, 15, "o total da matriz não deveria mudar");
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita D1 e D10 trocados entre os tópicos I e VI de Língua Portuguesa/5º ano, mesmo preservando toda contagem, unicidade e o total da matriz", () => {
  // Achado da revisão: validarGruposOficiais checava só a QUANTIDADE por grupo. Trocar D1 (tópico I,
  // "Procedimentos de leitura") por D10 (tópico VI, "Variação linguística") é indetectável por
  // contagem — os dois tópicos têm 5 e 1 descritores antes e depois da troca, a unicidade de cada
  // código na matriz continua valendo (nenhum duplicado), a densidade D1..D15 continua completa, e o
  // total da matriz continua 15. Só a comparação do CONJUNTO exato de códigos por grupo pega isso.
  const fixture = fixtureValida();
  const matriz = fixture.matrizes[0]; // anosIniciais/lp
  const grupoI = matriz.grupos.find((g) => g.numero === "I"); // oficialmente D1, D3, D4, D6, D11
  const grupoVI = matriz.grupos.find((g) => g.numero === "VI"); // oficialmente D10

  const d1 = grupoI.descritores.find((d) => d.codigo === "D1");
  const d10 = grupoVI.descritores.find((d) => d.codigo === "D10");
  assert.ok(d1 && d10, "fixture deveria ter D1 no grupo I e D10 no grupo VI antes da troca");
  d1.codigo = "D10";
  d10.codigo = "D1";

  // Confirma que a troca realmente preserva tudo que a validação anterior checava:
  const codigosTotais = matriz.grupos.flatMap((g) => g.descritores.map((d) => d.codigo));
  assert.equal(grupoI.descritores.length, 5, "tamanho do grupo I não deveria mudar");
  assert.equal(grupoVI.descritores.length, 1, "tamanho do grupo VI não deveria mudar");
  assert.equal(new Set(codigosTotais).size, codigosTotais.length, "nenhum código duplicado na matriz");
  const numeros = codigosTotais.map((c) => Number(c.slice(1))).sort((a, b) => a - b);
  assert.deepEqual(numeros, Array.from({ length: 15 }, (_, i) => i + 1), "densidade D1..D15 continua completa");
  assert.equal(codigosTotais.length, 15, "o total da matriz não deveria mudar");

  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita página de PDF além do total de páginas da fonte", () => {
  const fixture = fixtureValida();
  fixture.matrizes[0].grupos[0].descritores[0].paginasPdf = [999];
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita paginasImpressas vazia", () => {
  const fixture = fixtureValida();
  fixture.matrizes[0].grupos[0].descritores[0].paginasImpressas = [];
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita escopo incompleto — falta uma matriz do escopo de seis (ensinoMedio/mt)", () => {
  const fixture = fixtureValida();
  fixture.matrizes = fixture.matrizes.filter((m) => !(m.etapa === "ensinoMedio" && m.componente === "mt"));
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita etapa desconhecida", () => {
  const fixture = fixtureValida();
  fixture.matrizes[0].etapa = "etapaInventada";
  assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError);
});

test("gerar: rejeita título, órgão ou versão de uma fonte vazios", () => {
  for (const campo of ["titulo", "orgao", "versaoPublicacao"]) {
    const fixture = fixtureValida();
    fixture.fontes.lp[campo] = "";
    assert.throws(() => gerarComFixture(fixture), DescritoresGeracaoError, `deveria rejeitar fontes.lp.${campo} vazio`);
  }
});

// ---- verificarHashPdfLocal(): confere hashSha256 contra bytes de um arquivo local — nunca rede,
// nunca os PDFs oficiais (que não vivem no repositório): só fixtures pequenas geradas em tmpdir. ----

test("calcularHashSha256: calcula o SHA-256 real dos bytes de um arquivo local pequeno", () => {
  const caminho = join(dir, "fixture.pdf");
  const conteudo = "conteúdo de teste — bytes arbitrários, não é um PDF real";
  writeFileSync(caminho, conteudo, "utf-8");

  const hashEsperado = createHash("sha256").update(Buffer.from(conteudo, "utf-8")).digest("hex");
  assert.equal(calcularHashSha256(caminho), hashEsperado);
});

test("verificarHashPdfLocal: aceita quando o hash informado bate com os bytes reais do arquivo local", () => {
  const caminho = join(dir, "fixture.pdf");
  writeFileSync(caminho, "conteúdo de teste — bytes arbitrários, não é um PDF real", "utf-8");
  const hashReal = calcularHashSha256(caminho);

  assert.doesNotThrow(() => verificarHashPdfLocal({ caminhoArquivo: caminho, hashEsperado: hashReal }));
});

test("verificarHashPdfLocal: rejeita quando o hash informado diverge dos bytes reais do arquivo (arquivo substituído/corrompido)", () => {
  const caminho = join(dir, "fixture.pdf");
  writeFileSync(caminho, "conteúdo original", "utf-8");

  assert.throws(() => verificarHashPdfLocal({ caminhoArquivo: caminho, hashEsperado: "a".repeat(64) }), DescritoresGeracaoError);
});

test("verificarHashPdfLocal: detecta divergência quando o arquivo local muda de conteúdo depois do hash ter sido registrado", () => {
  const caminho = join(dir, "fixture.pdf");
  writeFileSync(caminho, "versão 1 do arquivo", "utf-8");
  const hashDaVersao1 = calcularHashSha256(caminho);

  writeFileSync(caminho, "versão 2 do arquivo — Inep republicou o PDF com uma correção", "utf-8");

  assert.throws(() => verificarHashPdfLocal({ caminhoArquivo: caminho, hashEsperado: hashDaVersao1 }), DescritoresGeracaoError);
});

// ---- verificar(): divergência entre fonte e catálogo versionado ----

test("verificar: o catálogo real, já versionado, está em dia com a fonte real", () => {
  assert.doesNotThrow(() => verificar());
});

test("verificar: não escreve na working tree ao validar o catálogo real", () => {
  const conteudoAntes = readFileSync(CATALOGO_REAL_PATH, "utf-8");
  const mtimeAntes = statSync(CATALOGO_REAL_PATH).mtimeMs;

  verificar();

  assert.equal(readFileSync(CATALOGO_REAL_PATH, "utf-8"), conteudoAntes);
  assert.equal(statSync(CATALOGO_REAL_PATH).mtimeMs, mtimeAntes);
});

test("verificar: detecta catálogo ausente (nunca gerado)", () => {
  const fonte = join(dir, "fonte.json");
  writeFileSync(fonte, JSON.stringify(fixtureValida()), "utf-8");
  const saida = join(dir, "matriz-lp-mt-2001.json");
  assert.throws(() => verificar({ fontePath: fonte, saidaPath: saida }), DescritoresGeracaoError);
});

test("verificar: detecta catálogo editado manualmente (bytes divergem, embora a fonte não tenha mudado)", () => {
  const fixture = fixtureValida();
  const fonte = join(dir, "fonte.json");
  const saida = join(dir, "matriz-lp-mt-2001.json");
  writeFileSync(fonte, JSON.stringify(fixture), "utf-8");
  gerar({ fontePath: fonte, saidaPath: saida, escrever: true });

  const gerado = readFileSync(saida, "utf-8");
  writeFileSync(saida, `${gerado} `, "utf-8");

  assert.throws(() => verificar({ fontePath: fonte, saidaPath: saida }), DescritoresGeracaoError);
});

test("verificar: detecta divergência de newline (CRLF em vez de LF) mesmo com o mesmo conteúdo textual", () => {
  const fixture = fixtureValida();
  const fonte = join(dir, "fonte.json");
  const saida = join(dir, "matriz-lp-mt-2001.json");
  writeFileSync(fonte, JSON.stringify(fixture), "utf-8");
  gerar({ fontePath: fonte, saidaPath: saida, escrever: true });

  const gerado = readFileSync(saida, "utf-8");
  writeFileSync(saida, gerado.replace(/\n/g, "\r\n"), "utf-8");

  assert.throws(() => verificar({ fontePath: fonte, saidaPath: saida }), DescritoresGeracaoError);
});

test("verificar: detecta fonte alterada sem que o catálogo tenha sido regenerado", () => {
  const fonte = join(dir, "fonte.json");
  const saida = join(dir, "matriz-lp-mt-2001.json");

  const fixtureA = fixtureValida();
  writeFileSync(fonte, JSON.stringify(fixtureA), "utf-8");
  gerar({ fontePath: fonte, saidaPath: saida, escrever: true });

  const fixtureB = fixtureValida();
  fixtureB.matrizes[0].grupos[0].descritores[0].texto = "Texto totalmente diferente, a fonte mudou.";
  writeFileSync(fonte, JSON.stringify(fixtureB), "utf-8");

  assert.throws(() => verificar({ fontePath: fonte, saidaPath: saida }), DescritoresGeracaoError);
});

test("verificar: passa quando o catálogo é regenerado corretamente após a fonte mudar", () => {
  const fonte = join(dir, "fonte.json");
  const saida = join(dir, "matriz-lp-mt-2001.json");

  writeFileSync(fonte, JSON.stringify(fixtureValida()), "utf-8");
  gerar({ fontePath: fonte, saidaPath: saida, escrever: true });

  const fixtureB = fixtureValida();
  fixtureB.matrizes[0].grupos[0].descritores[0].texto = "Texto totalmente diferente, a fonte mudou.";
  writeFileSync(fonte, JSON.stringify(fixtureB), "utf-8");
  gerar({ fontePath: fonte, saidaPath: saida, escrever: true });

  assert.doesNotThrow(() => verificar({ fontePath: fonte, saidaPath: saida }));
});
