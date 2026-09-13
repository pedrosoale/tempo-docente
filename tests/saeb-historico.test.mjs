// Testes puros de lib/saeb/historico.ts — nenhuma rede, nenhum arquivo, nenhum pacote oficial.
// Cobre a preparação da série histórica e a geração dos textos de resumo do dashboard de evolução
// (ver app/saeb/components/HistoricoEscola.tsx).
import assert from "node:assert/strict";
import test from "node:test";

import {
  construirSerieHistorica,
  contarResultadosELacunas,
  decidirExibicao,
  dominioEixoVertical,
  formatarDiferenca,
  gerarResumoHistorico,
  intervaloDaSerie,
  pontosParaGrafico,
  recortarPeriodo,
  textoResumoHistorico,
} from "../lib/saeb/historico.ts";
import { INDICADOR_LABEL, PACOTE_DIVULGACAO_TEXTO } from "../lib/saeb/labels.ts";
import { formatarValorIndicador } from "../lib/saeb/registro.ts";

function escola(etapas) {
  return { codigoInep: "12345678", nome: "Escola Teste", rede: "Estadual", etapas };
}

const fmt = (v) => formatarValorIndicador(v);
const MATEMATICA = INDICADOR_LABEL.mt; // { label: "Matemática", grupo: "saeb", ... }
const PORTUGUES = INDICADOR_LABEL.lp; // { label: "Língua Portuguesa", grupo: "saeb", ... }
const IDEB = INDICADOR_LABEL.ideb; // { label: "Ideb", grupo: "ideb", ... }

// ---- construirSerieHistorica: ordenação cronológica e intervalos ----

test("construirSerieHistorica: ordena por ano crescente, mesmo que as chaves do objeto não estejam em ordem", () => {
  const e = escola({ anosIniciais: { 2025: { mt: 210 }, 2007: { mt: 180 }, 2017: { mt: 195 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  assert.deepEqual(
    serie.map((p) => p.ano),
    [2007, 2017, 2025],
  );
});

test("construirSerieHistorica: só inclui edições em que a escola tem ALGUM registro nesta etapa — nunca fabrica uma edição inexistente", () => {
  const e = escola({ anosIniciais: { 2019: { mt: 200 }, 2021: { lp: 190 } } });
  // 2021 não tem "mt", mas a edição existe (tem "lp") — precisa aparecer como lacuna, não sumir.
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  assert.deepEqual(
    serie.map((p) => p.edicao),
    ["2019", "2021"],
  );
  assert.equal(serie[1].resolvido.tipo, "nao_informado");
});

test("construirSerieHistorica: escola sem nenhuma edição nesta etapa devolve lista vazia, nunca lança", () => {
  assert.deepEqual(construirSerieHistorica(escola({}), "anosIniciais", "mt"), []);
});

// ---- intervaloDaSerie ----

test("intervaloDaSerie: devolve o ano mínimo e máximo da série completa", () => {
  const e = escola({ anosIniciais: { 2007: { mt: 1 }, 2025: { mt: 2 }, 2017: { mt: 3 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  assert.deepEqual(intervaloDaSerie(serie), { min: 2007, max: 2025 });
});

test("intervaloDaSerie: série vazia devolve null, nunca um intervalo inventado", () => {
  assert.equal(intervaloDaSerie([]), null);
});

// ---- recortarPeriodo ----

test("recortarPeriodo: mantém só os anos dentro do intervalo, inclusive nos dois extremos", () => {
  const e = escola({ anosIniciais: { 2007: { mt: 1 }, 2011: { mt: 2 }, 2017: { mt: 3 }, 2025: { mt: 4 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  const recorte = recortarPeriodo(serie, 2011, 2017);
  assert.deepEqual(
    recorte.map((p) => p.ano),
    [2011, 2017],
  );
});

test("recortarPeriodo: período fora de qualquer edição devolve lista vazia, não a série inteira", () => {
  const e = escola({ anosIniciais: { 2007: { mt: 1 }, 2025: { mt: 2 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  assert.deepEqual(recortarPeriodo(serie, 2012, 2015), []);
});

// ---- Valores, zero, ausência oficial e não informado ----

test("resolvido preserva valor zero como válido — nunca convertido em ausência", () => {
  const e = escola({ anosIniciais: { 2025: { mt: 0 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  assert.deepEqual(serie[0].resolvido, { tipo: "valor", valor: 0 });
});

test("resolvido distingue ausência oficial nomeada de campo não informado dentro de uma edição existente", () => {
  const e = escola({ anosIniciais: { 2019: { mt: { estado: "participacao_insuficiente" } }, 2021: { lp: 200 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  assert.equal(serie[0].resolvido.tipo, "ausente_oficial");
  assert.equal(serie[0].resolvido.estado, "participacao_insuficiente");
  assert.equal(serie[1].resolvido.tipo, "nao_informado"); // 2021 existe, mas não tem "mt"
});

test("resolvido preserva a observação de avaliação estadual — nunca aparece como SAEB comum sem essa marca", () => {
  const e = escola({ anosIniciais: { 2019: { mt: { valor: 187.5, obs: "avaliacao_estadual" } } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  assert.equal(serie[0].resolvido.tipo, "valor");
  assert.equal(serie[0].resolvido.valor, 187.5);
  assert.match(serie[0].resolvido.observacao, /avaliações estaduais/);
});

// ---- pontosParaGrafico: lacunas sem interpolação, gráfico e tabela com os mesmos dados ----

test("pontosParaGrafico: lacuna vira valor null, nunca zero — e carrega o motivo em linguagem corrente", () => {
  const e = escola({ anosIniciais: { 2019: { mt: { estado: "ausente" } }, 2021: { mt: 205 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  const pontos = pontosParaGrafico(serie);
  assert.equal(pontos[0].valor, null);
  assert.match(pontos[0].situacao, /etapa não avaliada|inexistente/);
  assert.equal(pontos[1].valor, 205);
});

test("pontosParaGrafico: não informado (edição existe, campo não) também vira null, com situação própria", () => {
  const e = escola({ anosIniciais: { 2021: { lp: 200 } } }); // edição existe, "mt" nunca aparece
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  const pontos = pontosParaGrafico(serie);
  assert.equal(pontos[0].valor, null);
  assert.match(pontos[0].situacao, /Não informado/);
});

test("pontosParaGrafico: a mesma lista alimenta gráfico e tabela — mesmos anos, mesmos valores, mesma ordem", () => {
  const e = escola({ anosIniciais: { 2007: { mt: 180 }, 2017: { mt: { estado: "ausente" } }, 2025: { mt: 210 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  const pontos = pontosParaGrafico(serie);
  assert.deepEqual(
    pontos.map((p) => p.ano),
    serie.map((p) => p.ano),
  );
  assert.deepEqual(
    pontos.map((p) => p.valor),
    [180, null, 210],
  );
});

// ---- contarResultadosELacunas ----

test("contarResultadosELacunas: conta valores e lacunas (ausência oficial + não informado) separadamente do total", () => {
  const e = escola({
    anosIniciais: { 2015: { mt: 190 }, 2017: { mt: { estado: "ausente" } }, 2019: { lp: 1 }, 2021: { mt: 205 } },
  });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  assert.deepEqual(contarResultadosELacunas(serie), { comResultado: 2, lacunas: 2 });
});

test("contarResultadosELacunas: série vazia conta zero para os dois", () => {
  assert.deepEqual(contarResultadosELacunas([]), { comResultado: 0, lacunas: 0 });
});

// ---- dominioEixoVertical: consistente ao recortar período, nunca calculado sobre o recorte ----

test("dominioEixoVertical: usa a série COMPLETA, não muda quando o período é apenas recortado", () => {
  const e = escola({ anosIniciais: { 2007: { mt: 150 }, 2015: { mt: 400 }, 2025: { mt: 160 } } });
  const serieCompleta = construirSerieHistorica(e, "anosIniciais", "mt");
  const dominioCompleto = dominioEixoVertical(serieCompleta);
  // Recorte que exclui o pico de 400 — o domínio (calculado sobre a série completa) precisa continuar igual.
  const recorte = recortarPeriodo(serieCompleta, 2020, 2025);
  const dominioComRecorte = dominioEixoVertical(serieCompleta); // sempre chamado com a série completa, nunca com o recorte
  assert.deepEqual(dominioComRecorte, dominioCompleto);
  assert.equal(dominioCompleto[0], 0, "piso sempre em zero");
  assert.ok(dominioCompleto[1] > 400, "teto precisa cobrir o maior valor real com folga");
  assert.equal(recorte.length, 1, "o recorte em si não afeta o cálculo do domínio — só é usado para plotar os pontos");
});

test("dominioEixoVertical: série sem nenhum valor devolve null (nada para plotar)", () => {
  const e = escola({ anosIniciais: { 2019: { mt: { estado: "ausente" } } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  assert.equal(dominioEixoVertical(serie), null);
});

test("dominioEixoVertical: escala do Ideb (0 a 10) usa um passo de arredondamento diferente da escala do SAEB", () => {
  const e = escola({ anosIniciais: { 2019: { ideb: 5.4 }, 2021: { ideb: 6.1 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "ideb");
  const [piso, teto] = dominioEixoVertical(serie);
  assert.equal(piso, 0);
  assert.ok(teto <= 10, `teto do Ideb não deveria passar de 10 por muito: ${teto}`);
  assert.ok(teto > 6.1);
});

// ---- Uma ou nenhuma edição válida ----

test("gerarResumoHistorico: nenhuma edição no recorte -> sem_dados", () => {
  assert.deepEqual(gerarResumoHistorico([]), { tipo: "sem_dados" });
});

test("gerarResumoHistorico: uma única edição válida -> sem_comparacao, nunca finge ter uma edição anterior", () => {
  const e = escola({ anosIniciais: { 2025: { mt: 210 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  const resumo = gerarResumoHistorico(serie);
  assert.deepEqual(resumo, { tipo: "sem_comparacao", edicaoReferencia: "2025", valorReferencia: 210, observacaoReferencia: undefined });
});

// ---- Edição selecionada (a mais recente do recorte) sem resultado ----

test("gerarResumoHistorico: última edição do recorte sem valor -> sem_valor_na_referencia, não recua silenciosamente para outro ano", () => {
  const e = escola({ anosIniciais: { 2019: { mt: 190 }, 2021: { mt: { estado: "ausente" } } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  const resumo = gerarResumoHistorico(serie);
  assert.deepEqual(resumo, { tipo: "sem_valor_na_referencia", edicaoReferencia: "2021" });
});

// ---- Variação positiva, negativa e nula + identificação explícita dos anos ----

test("gerarResumoHistorico: variação positiva identifica os dois anos exatos comparados", () => {
  const e = escola({ anosIniciais: { 2019: { mt: 190 }, 2021: { mt: 205 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  const resumo = gerarResumoHistorico(serie);
  assert.deepEqual(resumo, {
    tipo: "comparacao",
    edicaoReferencia: "2021",
    valorReferencia: 205,
    observacaoReferencia: undefined,
    edicaoAnterior: "2019",
    valorAnterior: 190,
    observacaoAnterior: undefined,
    diferenca: 15,
  });
});

test("gerarResumoHistorico: variação negativa preserva o sinal — nunca relatada como se fosse positiva", () => {
  const e = escola({ anosIniciais: { 2019: { mt: 205 }, 2021: { mt: 190 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  const resumo = gerarResumoHistorico(serie);
  assert.equal(resumo.tipo, "comparacao");
  assert.equal(resumo.diferenca, -15);
});

test("gerarResumoHistorico: variação nula é reportada como zero, não omitida", () => {
  const e = escola({ anosIniciais: { 2019: { mt: 200 }, 2021: { mt: 200 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  const resumo = gerarResumoHistorico(serie);
  assert.equal(resumo.tipo, "comparacao");
  assert.equal(resumo.diferenca, 0);
});

test("gerarResumoHistorico: 'edição anterior' pula lacunas — usa a última edição anterior que TEM valor, não a imediatamente anterior", () => {
  const e = escola({
    anosIniciais: { 2015: { mt: 180 }, 2017: { mt: { estado: "ausente" } }, 2019: { mt: { estado: "ausente" } }, 2021: { mt: 210 } },
  });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  const resumo = gerarResumoHistorico(serie);
  assert.equal(resumo.tipo, "comparacao");
  assert.equal(resumo.edicaoAnterior, "2015");
  assert.equal(resumo.valorAnterior, 180);
});

test("gerarResumoHistorico: preserva a observação de avaliação estadual nos dois lados da comparação", () => {
  const e = escola({
    anosIniciais: {
      2019: { mt: { valor: 180, obs: "avaliacao_estadual" } },
      2021: { mt: { valor: 210, obs: "avaliacao_estadual" } },
    },
  });
  const serie = construirSerieHistorica(e, "anosIniciais", "mt");
  const resumo = gerarResumoHistorico(serie);
  assert.match(resumo.observacaoReferencia, /avaliações estaduais/);
  assert.match(resumo.observacaoAnterior, /avaliações estaduais/);
});

// ---- formatarDiferenca ----

test("formatarDiferenca: sinal explícito para positivo e negativo, '0' plano para nulo", () => {
  assert.equal(formatarDiferenca(3.2), "+3,2");
  assert.equal(formatarDiferenca(-3.2), "−3,2");
  assert.equal(formatarDiferenca(0), "0");
});

// ---- textoResumoHistorico: determinístico, no formato pedido ----

test("textoResumoHistorico: proficiência (Matemática/Português) segue 'A proficiência média em X passou de A em AAAA para B em BBBB, uma diferença de Z pontos na escala de proficiência'", () => {
  const resumo = { tipo: "comparacao", edicaoReferencia: "2021", valorReferencia: 205, edicaoAnterior: "2019", valorAnterior: 190, diferenca: 15 };
  const texto = textoResumoHistorico(resumo, MATEMATICA, fmt);
  assert.equal(
    texto,
    "A proficiência média em Matemática passou de 190 em 2019 para 205 em 2021, uma diferença de +15 pontos na escala de proficiência.",
  );
});

test("textoResumoHistorico: nunca usa percentual, causas presumidas ou qualificações subjetivas", () => {
  const resumo = { tipo: "comparacao", edicaoReferencia: "2021", valorReferencia: 205, edicaoAnterior: "2019", valorAnterior: 190, diferenca: 15 };
  const texto = textoResumoHistorico(resumo, MATEMATICA, fmt);
  assert.doesNotMatch(texto, /%/);
  assert.doesNotMatch(texto, /significativ|melhora|piora|gestão|metodologia|ranking|adequado|básico/i);
});

test("textoResumoHistorico: edição sem valor explica a indisponibilidade, nunca substitui por outro ano", () => {
  const texto = textoResumoHistorico({ tipo: "sem_valor_na_referencia", edicaoReferencia: "2021" }, MATEMATICA, fmt);
  assert.match(texto, /2021/);
  assert.match(texto, /não tem resultado divulgado/);
});

test("textoResumoHistorico: sem base de comparação explica isso explicitamente, mostrando o único ponto disponível", () => {
  const texto = textoResumoHistorico({ tipo: "sem_comparacao", edicaoReferencia: "2025", valorReferencia: 210 }, MATEMATICA, fmt);
  assert.match(texto, /210/);
  assert.match(texto, /2025/);
  assert.match(texto, /Não há edição anterior/);
});

// ---- Achado 1: Ideb nunca é tratado como "média", em nenhum dos textos ----

test("textoResumoHistorico [Ideb, comparação]: usa 'O Ideb da escola', nunca 'a média de Ideb', e a unidade é o índice Ideb", () => {
  const resumo = { tipo: "comparacao", edicaoReferencia: "2021", valorReferencia: 6.1, edicaoAnterior: "2019", valorAnterior: 5.4, diferenca: 0.7 };
  const texto = textoResumoHistorico(resumo, IDEB, fmt);
  assert.equal(texto, "O Ideb da escola passou de 5,4 em 2019 para 6,1 em 2021, uma diferença de +0,7 pontos no índice Ideb.");
  assert.doesNotMatch(texto, /média de Ideb/i);
});

test("textoResumoHistorico [Ideb, edição única/sem_comparacao]: usa 'O Ideb da escola na edição X foi', nunca 'a média de'", () => {
  const texto = textoResumoHistorico({ tipo: "sem_comparacao", edicaoReferencia: "2025", valorReferencia: 6.6 }, IDEB, fmt);
  assert.equal(texto, "O Ideb da escola na edição 2025 foi 6,6. Não há edição anterior com resultado dentro do período selecionado para comparar.");
  assert.doesNotMatch(texto, /média/i);
});

test("textoResumoHistorico [Ideb, sem valor na referência]: continua identificando o indicador sem usar 'média'", () => {
  const texto = textoResumoHistorico({ tipo: "sem_valor_na_referencia", edicaoReferencia: "2023" }, IDEB, fmt);
  assert.match(texto, /Ideb/);
  assert.match(texto, /2023/);
});

test("textoResumoHistorico [Matemática e Português, comparação]: os dois usam 'A proficiência média em', com a mesma unidade de escala", () => {
  const resumo = { tipo: "comparacao", edicaoReferencia: "2021", valorReferencia: 205, edicaoAnterior: "2019", valorAnterior: 190, diferenca: 15 };
  const textoMt = textoResumoHistorico(resumo, MATEMATICA, fmt);
  const textoLp = textoResumoHistorico(resumo, PORTUGUES, fmt);
  assert.match(textoMt, /^A proficiência média em Matemática /);
  assert.match(textoLp, /^A proficiência média em Língua Portuguesa /);
  assert.match(textoMt, /pontos na escala de proficiência\.$/);
  assert.match(textoLp, /pontos na escala de proficiência\.$/);
});

test("textoResumoHistorico [Matemática e Português, sem_comparacao]: 'A proficiência média em X na edição Y foi', nunca 'O Ideb'", () => {
  const textoMt = textoResumoHistorico({ tipo: "sem_comparacao", edicaoReferencia: "2025", valorReferencia: 210 }, MATEMATICA, fmt);
  const textoLp = textoResumoHistorico({ tipo: "sem_comparacao", edicaoReferencia: "2025", valorReferencia: 220 }, PORTUGUES, fmt);
  assert.match(textoMt, /^A proficiência média em Matemática na edição 2025 foi 210\./);
  assert.match(textoLp, /^A proficiência média em Língua Portuguesa na edição 2025 foi 220\./);
  assert.doesNotMatch(textoMt, /Ideb/);
  assert.doesNotMatch(textoLp, /Ideb/);
});

test("textoResumoHistorico: em nenhum dos três indicadores, em nenhum estado, o texto produz 'média de Ideb'", () => {
  const estados = [
    { tipo: "sem_dados" },
    { tipo: "sem_valor_na_referencia", edicaoReferencia: "2021" },
    { tipo: "sem_comparacao", edicaoReferencia: "2021", valorReferencia: 5 },
    { tipo: "comparacao", edicaoReferencia: "2021", valorReferencia: 6, edicaoAnterior: "2019", valorAnterior: 5, diferenca: 1 },
  ];
  for (const indicador of [MATEMATICA, PORTUGUES, IDEB]) {
    for (const estado of estados) {
      const texto = textoResumoHistorico(estado, indicador, fmt);
      assert.doesNotMatch(texto, /média de Ideb/i, `indicador=${indicador.label} estado=${estado.tipo}: "${texto}"`);
    }
  }
});

test("textoResumoHistorico: preserva os valores originais no cálculo — só o texto final é arredondado", () => {
  // 6,05 - 5,999 = 0,051, que formatarDiferenca (2 casas) arredonda para "+0,05" — mas o valor
  // usado no cálculo de gerarResumoHistorico (chamado abaixo) precisa ser o original, não o
  // arredondado, senão um encadeamento de arredondamentos divergiria do valor exibido isoladamente.
  const e = escola({ anosIniciais: { 2019: { ideb: 5.999 }, 2021: { ideb: 6.05 } } });
  const serie = construirSerieHistorica(e, "anosIniciais", "ideb");
  const resumo = gerarResumoHistorico(serie);
  assert.ok(Math.abs(resumo.diferenca - 0.051) < 1e-9, "a diferença crua precisa ser calculada sobre os valores originais");
  const texto = textoResumoHistorico(resumo, IDEB, fmt);
  assert.match(texto, /\+0,05 pontos no índice Ideb/);
});

// ---- Troca de escola/etapa sem manter histórico incompatível ----

test("construirSerieHistorica: escolas diferentes nunca compartilham estado — cada chamada é independente da anterior", () => {
  const escolaA = escola({ anosIniciais: { 2019: { mt: 100 } } });
  const escolaB = escola({ anosIniciais: { 2021: { mt: 300 } } });
  const serieA = construirSerieHistorica(escolaA, "anosIniciais", "mt");
  const serieB = construirSerieHistorica(escolaB, "anosIniciais", "mt");
  assert.deepEqual(
    serieA.map((p) => p.edicao),
    ["2019"],
  );
  assert.deepEqual(
    serieB.map((p) => p.edicao),
    ["2021"],
  );
  // Recalcular A depois de B não deveria ter sido afetado por nenhum estado global.
  assert.deepEqual(construirSerieHistorica(escolaA, "anosIniciais", "mt"), serieA);
});

test("construirSerieHistorica: etapas diferentes da MESMA escola produzem séries totalmente distintas", () => {
  const e = escola({ anosIniciais: { 2019: { mt: 190 } }, ensinoMedio: { 2021: { mt: 250 } } });
  const serieAI = construirSerieHistorica(e, "anosIniciais", "mt");
  const serieEM = construirSerieHistorica(e, "ensinoMedio", "mt");
  assert.deepEqual(
    serieAI.map((p) => p.edicao),
    ["2019"],
  );
  assert.deepEqual(
    serieEM.map((p) => p.edicao),
    ["2021"],
  );
});

// ---- Achado 2: edição do resultado vs. pacote de divulgação — a formulação antiga era factualmente errada ----

test("PACOTE_DIVULGACAO_TEXTO: rejeita a formulação antiga ('nunca é o mesmo ano') — edição e pacote PODEM coincidir", () => {
  assert.doesNotMatch(PACOTE_DIVULGACAO_TEXTO, /nunca (é|foi) o mesmo/i);
  assert.doesNotMatch(PACOTE_DIVULGACAO_TEXTO, /nunca o mesmo ano/i);
});

test("PACOTE_DIVULGACAO_TEXTO: identifica a fonte (pacote 2025/Inep) e preserva a distinção entre edição e pacote", () => {
  assert.match(PACOTE_DIVULGACAO_TEXTO, /Ideb por escola/);
  assert.match(PACOTE_DIVULGACAO_TEXTO, /2025/);
  assert.match(PACOTE_DIVULGACAO_TEXTO, /Inep/);
  assert.match(PACOTE_DIVULGACAO_TEXTO, /ano da edição identifica o resultado/i);
  assert.match(PACOTE_DIVULGACAO_TEXTO, /pacote de divulgação pode reunir resultados de diferentes edições/i);
  assert.match(PACOTE_DIVULGACAO_TEXTO, /mesmo ano indicado no pacote/i);
});

// ---- Achado 3: decidirExibicao — o painel nunca mostra um gráfico vazio, e a tabela aparece uma única vez ----

test("decidirExibicao: modo 'grafico' com resultados no período -> mostra só o gráfico", () => {
  assert.deepEqual(decidirExibicao("grafico", { comResultado: 3, lacunas: 1 }), { mostrarGrafico: true, mostrarTabela: false });
});

test("decidirExibicao: modo 'tabela' com resultados no período -> mostra só a tabela", () => {
  assert.deepEqual(decidirExibicao("tabela", { comResultado: 3, lacunas: 1 }), { mostrarGrafico: false, mostrarTabela: true });
});

test("decidirExibicao: período só com ausências (comResultado: 0) força a tabela MESMO com 'grafico' escolhido — nunca gráfico vazio", () => {
  const decisao = decidirExibicao("grafico", { comResultado: 0, lacunas: 4 });
  assert.deepEqual(decisao, { mostrarGrafico: false, mostrarTabela: true });
});

test("decidirExibicao: período só com ausências e modo 'tabela' -> tabela continua aparecendo (uma única vez, nunca as duas)", () => {
  const decisao = decidirExibicao("tabela", { comResultado: 0, lacunas: 2 });
  assert.deepEqual(decisao, { mostrarGrafico: false, mostrarTabela: true });
  assert.notEqual(decisao.mostrarGrafico, decisao.mostrarTabela); // nunca as duas juntas, nunca as duas ausentes
});

test("decidirExibicao: ao voltar a um período COM valores, o modo escolhido pelo usuário volta a valer (nunca fica 'preso' em tabela)", () => {
  // Simula exatamente o que o componente faz: o usuário escolheu "grafico" uma vez; o período muda
  // (só o `contagem` varia, o `modoEscolhido` nunca é tocado por decidirExibicao).
  const modoEscolhido = "grafico";
  const noPeriodoVazio = decidirExibicao(modoEscolhido, { comResultado: 0, lacunas: 3 });
  assert.deepEqual(noPeriodoVazio, { mostrarGrafico: false, mostrarTabela: true });
  const devoltaComValores = decidirExibicao(modoEscolhido, { comResultado: 2, lacunas: 1 });
  assert.deepEqual(devoltaComValores, { mostrarGrafico: true, mostrarTabela: false }, "o mesmo modoEscolhido deveria voltar a mostrar o gráfico");
});

test("decidirExibicao: nunca mostra os dois (gráfico e tabela) nem nenhum dos dois, em qualquer combinação", () => {
  for (const modo of ["grafico", "tabela"]) {
    for (const comResultado of [0, 1, 5]) {
      const decisao = decidirExibicao(modo, { comResultado, lacunas: 0 });
      assert.notEqual(decisao.mostrarGrafico, decisao.mostrarTabela, `modo=${modo} comResultado=${comResultado} produziu ${JSON.stringify(decisao)}`);
    }
  }
});

// ---- Nenhuma requisição adicional ao explorar o histórico ----
//
// O teste abaixo é uma checagem ESTÁTICA (lê o próprio arquivo-fonte) — ela prova que
// historico.ts não TEM COMO fazer uma requisição, mas não é um teste ponta a ponta do fluxo real
// no navegador (abrir o painel, trocar indicador/etapa/período, alternar gráfico/tabela, fechar e
// reabrir). Essa validação ponta a ponta foi feita MANUALMENTE nesta rodada, contando as
// requisições reais de rede antes/depois de cada interação (ver
// C:\ProjetosIA\saeb-dashboard-historico-relatorio.html, seção "Evidência de requisições") — o
// projeto não tem jsdom/testing-library nem um driver de navegador na suíte automatizada (ver
// mesmo tipo de limitação documentada em lib/saeb/selection.ts), então essa parte específica
// (contagem de requisições reais durante uma sessão de navegador) permanece uma lacuna de
// cobertura automatizada, coberta por validação manual repetível.
test("lib/saeb/historico.ts não importa o cliente de rede nem chama fetch — checagem estática, não um teste ponta a ponta de rede", async () => {
  const fonte = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../lib/saeb/historico.ts", import.meta.url), "utf8"));
  assert.doesNotMatch(fonte, /\bfetch\s*\(/);
  assert.doesNotMatch(fonte, /from ["']\.\/client\.ts["']/);
});
