// Testes puros de lib/saeb/interpretacao.ts — nenhuma rede, nenhum estado de UI. Os limites
// numéricos usados abaixo são os valores oficiais documentados nos Quadros 1, 2, 3, 4, 5 e 6 de
// escalas_de_proficiencia_do_saeb.pdf (conferidos contra o PDF — ver
// C:\ProjetosIA\saeb-interpretacao-pedagogica-piloto-relatorio.html), nunca recalculados a partir
// da própria implementação.
import assert from "node:assert/strict";
import test from "node:test";

import { buscarEscala } from "../lib/saeb/escalas.ts";
import {
  comPreposicao,
  compararComEdicaoAnterior,
  edicaoAnteriorDocumentada,
  faixasAnteriores,
  linhasDaDescricaoSemIntroducaoOficial,
  resolverPosicaoNaEscala,
  textoIntervalo,
} from "../lib/saeb/interpretacao.ts";

function valor(v, observacao) {
  return observacao ? { tipo: "valor", valor: v, observacao } : { tipo: "valor", valor: v };
}

function base(overrides) {
  return { etapa: "anosFinais", componente: "lp", edicao: "2023", resultado: valor(0), ...overrides };
}

// ---- Escopo do piloto ----

test("fora do piloto: uma etapa fora do union conhecido (5º ano, 9º ano, Ensino Médio) nunca é classificada", () => {
  const estado = resolverPosicaoNaEscala(base({ etapa: "anoQualquerInventado" }));
  assert.equal(estado.tipo, "fora_do_piloto");
});

test("as seis combinações do piloto (3 etapas × LP/MT) resolvem normalmente em 2023 — sem regressão das edições 2005–2023 com a expansão de escopo", () => {
  for (const etapa of ["anosIniciais", "anosFinais", "ensinoMedio"]) {
    for (const componente of ["lp", "mt"]) {
      const estado = resolverPosicaoNaEscala(base({ etapa, componente, edicao: "2023", resultado: valor(260) }));
      assert.equal(estado.tipo, "resolvido", `${etapa}/${componente} deveria resolver em 2023`);
    }
  }
});

test("2005 (primeira edição documentada de 5º e 9º ano) resolve normalmente nas seis combinações, exceto Ensino Médio (só a partir de 2017)", () => {
  for (const etapa of ["anosIniciais", "anosFinais"]) {
    for (const componente of ["lp", "mt"]) {
      const estado = resolverPosicaoNaEscala(base({ etapa, componente, edicao: "2005", resultado: valor(260) }));
      assert.equal(estado.tipo, "resolvido", `${etapa}/${componente} deveria resolver em 2005`);
    }
  }
  for (const componente of ["lp", "mt"]) {
    const estado = resolverPosicaoNaEscala(base({ etapa: "ensinoMedio", componente, edicao: "2005", resultado: valor(260) }));
    assert.equal(estado.tipo, "edicao_nao_documentada", `ensinoMedio/${componente} não deveria classificar 2005 (Ideb por escola do EM só existe desde 2017)`);
  }
});

test("fora do piloto: componente Ideb nunca é classificado por escala de proficiência", () => {
  const estado = resolverPosicaoNaEscala(base({ componente: "ideb", resultado: valor(5.4) }));
  assert.equal(estado.tipo, "fora_do_piloto");
});

test("fora do piloto: componentes N, P e meta também nunca são classificados por escala de proficiência", () => {
  for (const componente of ["n", "p", "meta"]) {
    const estado = resolverPosicaoNaEscala(base({ componente, resultado: valor(5) }));
    assert.equal(estado.tipo, "fora_do_piloto", `componente ${componente} deveria ficar fora do piloto`);
  }
});

// ---- Edição fora da documentação ----

test("2025 é classificado normalmente nas seis combinações do piloto (3 etapas × LP/MT) — a cartilha oficial confirma a mesma matriz 2001 das edições anteriores", () => {
  for (const etapa of ["anosIniciais", "anosFinais", "ensinoMedio"]) {
    for (const componente of ["lp", "mt"]) {
      const estado = resolverPosicaoNaEscala(base({ etapa, componente, edicao: "2025", resultado: valor(260) }));
      assert.equal(estado.tipo, "resolvido", `${etapa}/${componente} deveria classificar 2025 normalmente`);
    }
  }
});

test("edição fora da série documentada (anterior a 2005) fica fora da classificação automática, sem afirmar incompatibilidade", () => {
  const estado = resolverPosicaoNaEscala(base({ edicao: "2003", resultado: valor(260) }));
  assert.equal(estado.tipo, "edicao_nao_documentada");
  assert.doesNotMatch(estado.motivo.toLowerCase(), /incompat/);
});

test("Ensino Médio: edição anterior a 2017 (antes de o Ideb por escola existir para essa etapa) fica fora da classificação automática", () => {
  const estado = resolverPosicaoNaEscala(base({ etapa: "ensinoMedio", edicao: "2015", resultado: valor(260) }));
  assert.equal(estado.tipo, "edicao_nao_documentada");
});

test("edição documentada (2023) resolve normalmente", () => {
  const estado = resolverPosicaoNaEscala(base({ edicao: "2023", resultado: valor(260) }));
  assert.equal(estado.tipo, "resolvido");
});

// ---- Ausência, não informado, zero e observação ----

test("ausência oficial nomeada é preservada, nunca convertida em faixa ou em zero", () => {
  const estado = resolverPosicaoNaEscala(base({ resultado: { tipo: "ausente_oficial", estado: "ausente", motivo: "Sem resultado nesta edição." } }));
  assert.equal(estado.tipo, "ausente_oficial");
  assert.equal(estado.estado, "ausente");
});

test("indicador não informado não produz nenhuma faixa", () => {
  const estado = resolverPosicaoNaEscala(base({ resultado: { tipo: "nao_informado" } }));
  assert.deepEqual(estado, { tipo: "nao_informado" });
});

test("zero é um valor genuíno e resolve normalmente na faixa mais baixa — nunca tratado como ausência", () => {
  const estado = resolverPosicaoNaEscala(base({ resultado: valor(0) }));
  assert.equal(estado.tipo, "resolvido");
  assert.equal(estado.valor, 0);
  assert.equal(estado.faixa.nivel, 0);
});

test("resultado com observação de avaliação estadual nunca é classificado automaticamente, e a observação é preservada", () => {
  const estado = resolverPosicaoNaEscala(base({ resultado: valor(260, "Média calculada a partir das avaliações estaduais.") }));
  assert.equal(estado.tipo, "observacao_nao_confirmada");
  assert.equal(estado.observacao, "Média calculada a partir das avaliações estaduais.");
});

// ---- Valores inválidos ----

test("NaN é rejeitado explicitamente, nunca classificado", () => {
  const estado = resolverPosicaoNaEscala(base({ resultado: valor(NaN) }));
  assert.equal(estado.tipo, "invalido");
});

test("Infinity é rejeitado explicitamente, nunca classificado", () => {
  const estado = resolverPosicaoNaEscala(base({ resultado: valor(Infinity) }));
  assert.equal(estado.tipo, "invalido");
  const estadoNegInf = resolverPosicaoNaEscala(base({ resultado: valor(-Infinity) }));
  assert.equal(estadoNegInf.tipo, "invalido");
});

// ---- Fronteiras oficiais — Língua Portuguesa, 9º ano / Anos Finais (Quadro 3) ----
// [0,200) Abaixo do Nível 1 · [200,225) N1 · [225,250) N2 · ... · [350,375) N7 · [375,∞) N8

test("LP (9º ano): 199,99 cai em 'Abaixo do Nível 1', nunca no Nível 1", () => {
  const estado = resolverPosicaoNaEscala(base({ componente: "lp", resultado: valor(199.99) }));
  assert.equal(estado.faixa.nivel, 0);
});

test("LP (9º ano): exatamente 200 (limite inferior inclusive) já cai no Nível 1", () => {
  const estado = resolverPosicaoNaEscala(base({ componente: "lp", resultado: valor(200) }));
  assert.equal(estado.faixa.nivel, 1);
});

test("LP (9º ano): 224,99 ainda é Nível 1; exatamente 225 (limite superior exclusive) já é Nível 2", () => {
  const abaixo = resolverPosicaoNaEscala(base({ componente: "lp", resultado: valor(224.99) }));
  const no_limite = resolverPosicaoNaEscala(base({ componente: "lp", resultado: valor(225) }));
  assert.equal(abaixo.faixa.nivel, 1);
  assert.equal(no_limite.faixa.nivel, 2);
});

test("LP (9º ano): exatamente 375 cai no Nível 8, o nível mais alto (aberto no topo)", () => {
  const estado = resolverPosicaoNaEscala(base({ componente: "lp", resultado: valor(375) }));
  assert.equal(estado.faixa.nivel, 8);
  assert.equal(estado.faixa.limiteSuperior, null);
});

test("LP (9º ano): um valor muito alto (999) ainda cai no Nível 8 — nunca fica sem faixa por estar acima de todas as fronteiras tabuladas", () => {
  const estado = resolverPosicaoNaEscala(base({ componente: "lp", resultado: valor(999) }));
  assert.equal(estado.faixa.nivel, 8);
});

// ---- Fronteiras oficiais — Matemática, 9º ano / Anos Finais (Quadro 4) ----
// Mesmas fronteiras de LP até o Nível 7, mas com Nível 8 [375,400) fechado e Nível 9 [400,∞) aberto.

test("MT (9º ano): 375 cai no Nível 8 (fechado, [375,400)), diferente de LP onde 375 já é o nível aberto", () => {
  const estado = resolverPosicaoNaEscala(base({ componente: "mt", resultado: valor(375) }));
  assert.equal(estado.faixa.nivel, 8);
  assert.equal(estado.faixa.limiteSuperior, 400);
});

test("MT (9º ano): 399,99 ainda é Nível 8; exatamente 400 já é o Nível 9, o mais alto (aberto no topo)", () => {
  const abaixo = resolverPosicaoNaEscala(base({ componente: "mt", resultado: valor(399.99) }));
  const noLimite = resolverPosicaoNaEscala(base({ componente: "mt", resultado: valor(400) }));
  assert.equal(abaixo.faixa.nivel, 8);
  assert.equal(noLimite.faixa.nivel, 9);
  assert.equal(noLimite.faixa.limiteSuperior, null);
});

test("LP e MT nunca compartilham a mesma escala — o mesmo valor pode cair em níveis diferentes", () => {
  const lp = resolverPosicaoNaEscala(base({ componente: "lp", resultado: valor(380) }));
  const mt = resolverPosicaoNaEscala(base({ componente: "mt", resultado: valor(380) }));
  assert.equal(lp.faixa.nivel, 8);
  assert.equal(mt.faixa.nivel, 8);
  assert.equal(lp.faixa.limiteSuperior, null);
  assert.equal(mt.faixa.limiteSuperior, 400); // faixas numericamente coincidentes em nível, mas fronteiras distintas
});

// ---- Fronteiras oficiais — Língua Portuguesa e Matemática, 5º ano / Anos Iniciais (Quadros 1 e 2) ----
// LP: [0,125) Abaixo do N1 · 125 a 325 em passos de 25 · [325,∞) N9.
// MT: [0,125) Abaixo do N1 · 125 a 350 em passos de 25 · [350,∞) N10.

test("LP (5º ano): 124,99 cai em 'Abaixo do Nível 1'; exatamente 125 já é o Nível 1", () => {
  const abaixo = resolverPosicaoNaEscala(base({ etapa: "anosIniciais", componente: "lp", resultado: valor(124.99) }));
  const noLimite = resolverPosicaoNaEscala(base({ etapa: "anosIniciais", componente: "lp", resultado: valor(125) }));
  assert.equal(abaixo.faixa.nivel, 0);
  assert.equal(noLimite.faixa.nivel, 1);
});

test("LP (5º ano): exatamente 325 cai no Nível 9, o mais alto (aberto no topo) — diferente do 9º ano, cujo teto de LP é 375", () => {
  const estado = resolverPosicaoNaEscala(base({ etapa: "anosIniciais", componente: "lp", resultado: valor(325) }));
  assert.equal(estado.faixa.nivel, 9);
  assert.equal(estado.faixa.limiteSuperior, null);
});

test("MT (5º ano): exatamente 350 cai no Nível 10, o mais alto (aberto no topo)", () => {
  const abaixo = resolverPosicaoNaEscala(base({ etapa: "anosIniciais", componente: "mt", resultado: valor(349.99) }));
  const noLimite = resolverPosicaoNaEscala(base({ etapa: "anosIniciais", componente: "mt", resultado: valor(350) }));
  assert.equal(abaixo.faixa.nivel, 9);
  assert.equal(noLimite.faixa.nivel, 10);
  assert.equal(noLimite.faixa.limiteSuperior, null);
});

// ---- Fronteiras oficiais — Língua Portuguesa e Matemática, Ensino Médio (Quadros 5 e 6) ----
// LP: [0,225) Abaixo do N1 · 225 a 400 em passos de 25 · [400,∞) N8.
// MT: [0,225) Abaixo do N1 · 225 a 450 em passos de 25 · [450,∞) N10.

test("LP (Ensino Médio): 224,99 cai em 'Abaixo do Nível 1'; exatamente 225 já é o Nível 1", () => {
  const abaixo = resolverPosicaoNaEscala(base({ etapa: "ensinoMedio", componente: "lp", resultado: valor(224.99) }));
  const noLimite = resolverPosicaoNaEscala(base({ etapa: "ensinoMedio", componente: "lp", resultado: valor(225) }));
  assert.equal(abaixo.faixa.nivel, 0);
  assert.equal(noLimite.faixa.nivel, 1);
});

test("LP (Ensino Médio): exatamente 400 cai no Nível 8, o mais alto (aberto no topo)", () => {
  const estado = resolverPosicaoNaEscala(base({ etapa: "ensinoMedio", componente: "lp", resultado: valor(400) }));
  assert.equal(estado.faixa.nivel, 8);
  assert.equal(estado.faixa.limiteSuperior, null);
});

test("MT (Ensino Médio): exatamente 450 cai no Nível 10, o mais alto (aberto no topo) — o maior teto entre todas as escalas do piloto", () => {
  const abaixo = resolverPosicaoNaEscala(base({ etapa: "ensinoMedio", componente: "mt", resultado: valor(449.99) }));
  const noLimite = resolverPosicaoNaEscala(base({ etapa: "ensinoMedio", componente: "mt", resultado: valor(450) }));
  assert.equal(abaixo.faixa.nivel, 9);
  assert.equal(noLimite.faixa.nivel, 10);
  assert.equal(noLimite.faixa.limiteSuperior, null);
});

// ---- textoIntervalo ----

test("textoIntervalo: faixa fechada usa o vocabulário oficial 'maior ou igual a X e menor que Y'", () => {
  const estado = resolverPosicaoNaEscala(base({ componente: "lp", resultado: valor(210) }));
  assert.equal(textoIntervalo(estado.faixa), "maior ou igual a 200 e menor que 225");
});

test("textoIntervalo: faixa aberta no topo usa 'maior ou igual a X', sem mencionar um teto inexistente", () => {
  const estado = resolverPosicaoNaEscala(base({ componente: "lp", resultado: valor(400) }));
  assert.equal(textoIntervalo(estado.faixa), "maior ou igual a 375");
});

test("textoIntervalo: faixa aberta embaixo (Abaixo do Nível 1) usa apenas 'menor que Y', nunca inventa um piso", () => {
  const estado = resolverPosicaoNaEscala(base({ componente: "lp", resultado: valor(50) }));
  assert.equal(textoIntervalo(estado.faixa), "menor que 200");
});

// ---- edicaoAnteriorDocumentada ----

test("edicaoAnteriorDocumentada: 2023 é a edição imediatamente anterior a 2025, no 9º ano", () => {
  const escala = buscarEscala("anosFinais", "lp");
  assert.equal(edicaoAnteriorDocumentada(escala, "2025"), "2023");
});

test("edicaoAnteriorDocumentada: 2005 (primeira edição documentada do 9º ano) não tem antecessora — retorna null", () => {
  const escala = buscarEscala("anosFinais", "lp");
  assert.equal(edicaoAnteriorDocumentada(escala, "2005"), null);
});

test("edicaoAnteriorDocumentada: 2017 (primeira edição documentada do Ensino Médio) não tem antecessora — retorna null, nunca aponta para 2015", () => {
  const escala = buscarEscala("ensinoMedio", "mt");
  assert.equal(edicaoAnteriorDocumentada(escala, "2017"), null);
});

test("edicaoAnteriorDocumentada: 2023 é a edição imediatamente anterior a 2025 também no Ensino Médio", () => {
  const escala = buscarEscala("ensinoMedio", "mt");
  assert.equal(edicaoAnteriorDocumentada(escala, "2025"), "2023");
});

test("edicaoAnteriorDocumentada: edição que não está na lista de edições associadas retorna null, nunca uma adivinhação", () => {
  const escala = buscarEscala("anosFinais", "lp");
  assert.equal(edicaoAnteriorDocumentada(escala, "1999"), null);
});

// ---- compararComEdicaoAnterior ----

test("compararComEdicaoAnterior: aumento — diferença positiva e direção 'aumento'", () => {
  const comparacao = compararComEdicaoAnterior({
    edicaoAtual: "2025",
    resultadoAtual: valor(260),
    edicaoAnterior: "2023",
    resultadoAnterior: valor(240),
  });
  assert.equal(comparacao.direcao, "aumento");
  assert.equal(comparacao.diferenca, 20);
  assert.equal(comparacao.valorAtual, 260);
  assert.equal(comparacao.valorAnterior, 240);
  assert.equal(comparacao.edicaoAtual, "2025");
  assert.equal(comparacao.edicaoAnterior, "2023");
});

test("compararComEdicaoAnterior: redução — diferença negativa e direção 'reducao'", () => {
  const comparacao = compararComEdicaoAnterior({
    edicaoAtual: "2025",
    resultadoAtual: valor(240),
    edicaoAnterior: "2023",
    resultadoAnterior: valor(260),
  });
  assert.equal(comparacao.direcao, "reducao");
  assert.equal(comparacao.diferenca, -20);
});

test("compararComEdicaoAnterior: estável — diferença exatamente zero, sem inventar um limiar de 'sem mudança significativa'", () => {
  const comparacao = compararComEdicaoAnterior({
    edicaoAtual: "2025",
    resultadoAtual: valor(250),
    edicaoAnterior: "2023",
    resultadoAnterior: valor(250),
  });
  assert.equal(comparacao.direcao, "estavel");
  assert.equal(comparacao.diferenca, 0);
});

test("compararComEdicaoAnterior: retorna null quando o lado atual está ausente/não informado/inválido", () => {
  for (const resultadoAtual of [{ tipo: "ausente_oficial", estado: "ausente", motivo: "x" }, { tipo: "nao_informado" }]) {
    const comparacao = compararComEdicaoAnterior({ edicaoAtual: "2025", resultadoAtual, edicaoAnterior: "2023", resultadoAnterior: valor(250) });
    assert.equal(comparacao, null);
  }
});

test("compararComEdicaoAnterior: retorna null quando o lado anterior está ausente/não informado/inválido", () => {
  for (const resultadoAnterior of [{ tipo: "ausente_oficial", estado: "ausente", motivo: "x" }, { tipo: "nao_informado" }]) {
    const comparacao = compararComEdicaoAnterior({ edicaoAtual: "2025", resultadoAtual: valor(250), edicaoAnterior: "2023", resultadoAnterior });
    assert.equal(comparacao, null);
  }
});

test("compararComEdicaoAnterior: retorna null quando qualquer um dos dois lados carrega uma ressalva (observação) não confirmada", () => {
  const atualComRessalva = compararComEdicaoAnterior({
    edicaoAtual: "2025",
    resultadoAtual: valor(250, "Média calculada a partir das avaliações estaduais."),
    edicaoAnterior: "2023",
    resultadoAnterior: valor(240),
  });
  assert.equal(atualComRessalva, null);

  const anteriorComRessalva = compararComEdicaoAnterior({
    edicaoAtual: "2025",
    resultadoAtual: valor(250),
    edicaoAnterior: "2023",
    resultadoAnterior: valor(240, "Média calculada a partir das avaliações estaduais."),
  });
  assert.equal(anteriorComRessalva, null);
});

test("compararComEdicaoAnterior: nunca calcula significância estatística nem atribui causa — o resultado só traz números e a direção do sinal", () => {
  const comparacao = compararComEdicaoAnterior({
    edicaoAtual: "2025",
    resultadoAtual: valor(260),
    edicaoAnterior: "2023",
    resultadoAnterior: valor(240),
  });
  const chaves = Object.keys(comparacao).sort();
  assert.deepEqual(chaves, ["diferenca", "direcao", "edicaoAnterior", "edicaoAtual", "valorAnterior", "valorAtual"]);
});

// ---- faixasAnteriores — consulta aos níveis anteriores (rodada "redação e consulta cumulativa") ----

test("faixasAnteriores: nível 0 nunca tem anteriores — lista vazia em todas as seis escalas", () => {
  for (const etapa of ["anosIniciais", "anosFinais", "ensinoMedio"]) {
    for (const componente of ["lp", "mt"]) {
      const escala = buscarEscala(etapa, componente);
      assert.deepEqual(faixasAnteriores(escala, 0), [], `${etapa}/${componente} nível 0 não deveria ter anteriores`);
    }
  }
});

test("faixasAnteriores: ordem decrescente — o imediatamente anterior vem primeiro, o mais baixo por último", () => {
  const escala = buscarEscala("ensinoMedio", "mt"); // 11 níveis, 0–10
  const anteriores = faixasAnteriores(escala, 5);
  assert.deepEqual(anteriores.map((f) => f.nivel), [4, 3, 2, 1, 0]);
});

test("faixasAnteriores: nunca inclui o próprio nível atual, nem níveis posteriores a ele", () => {
  const escala = buscarEscala("anosFinais", "lp"); // 9 níveis, 0–8
  const anteriores = faixasAnteriores(escala, 4);
  for (const faixa of anteriores) {
    assert.ok(faixa.nivel < 4, `nível ${faixa.nivel} deveria ser < 4`);
  }
  assert.ok(!anteriores.some((f) => f.nivel === 4), "não deveria incluir o próprio nível atual (4)");
  assert.ok(!anteriores.some((f) => f.nivel > 4), "não deveria incluir níveis posteriores (>4)");
});

test("faixasAnteriores: no nível mais alto de uma escala, devolve TODOS os níveis abaixo, em ordem decrescente", () => {
  const escala = buscarEscala("anosIniciais", "mt"); // 11 níveis, 0–10
  const anteriores = faixasAnteriores(escala, 10);
  assert.deepEqual(anteriores.map((f) => f.nivel), [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
});

test("faixasAnteriores: funciona corretamente nas seis escalas do piloto, com a contagem exata de níveis anteriores esperada", () => {
  const casos = [
    ["anosIniciais", "lp", 9, [8, 7, 6, 5, 4, 3, 2, 1, 0]], // 10 níveis (0–9)
    ["anosIniciais", "mt", 10, [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]], // 11 níveis (0–10)
    ["anosFinais", "lp", 8, [7, 6, 5, 4, 3, 2, 1, 0]], // 9 níveis (0–8)
    ["anosFinais", "mt", 9, [8, 7, 6, 5, 4, 3, 2, 1, 0]], // 10 níveis (0–9)
    ["ensinoMedio", "lp", 8, [7, 6, 5, 4, 3, 2, 1, 0]], // 9 níveis (0–8)
    ["ensinoMedio", "mt", 10, [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]], // 11 níveis (0–10)
  ];
  for (const [etapa, componente, nivelMaisAlto, esperado] of casos) {
    const escala = buscarEscala(etapa, componente);
    const anteriores = faixasAnteriores(escala, nivelMaisAlto);
    assert.deepEqual(anteriores.map((f) => f.nivel), esperado, `${etapa}/${componente}`);
  }
});

test("faixasAnteriores: o conteúdo de cada nível anterior vem do catálogo real — mesma descricaoOficial e nomeNivel de buscarEscala", () => {
  const escala = buscarEscala("ensinoMedio", "lp");
  const anteriores = faixasAnteriores(escala, 3);
  const nivel2DoCatalogo = escala.niveis.find((f) => f.nivel === 2);
  const nivel2NosAnteriores = anteriores.find((f) => f.nivel === 2);
  assert.equal(nivel2NosAnteriores.descricaoOficial, nivel2DoCatalogo.descricaoOficial);
  assert.equal(nivel2NosAnteriores.nomeNivel, nivel2DoCatalogo.nomeNivel);
  assert.equal(nivel2NosAnteriores.paginasPdf.join(","), nivel2DoCatalogo.paginasPdf.join(","));
});

test("faixasAnteriores: tratamento do Nível 0 — nome oficial correto conforme a escala (\"Nível 0\" só nas duas de 5º ano)", () => {
  const nomesEsperados = {
    "anosIniciais/lp": "Nível 0",
    "anosIniciais/mt": "Nível 0",
    "anosFinais/lp": "Abaixo do Nível 1",
    "anosFinais/mt": "Abaixo do Nível 1",
    "ensinoMedio/lp": "Abaixo do Nível 1",
    "ensinoMedio/mt": "Abaixo do Nível 1",
  };
  for (const [chave, nomeEsperado] of Object.entries(nomesEsperados)) {
    const [etapa, componente] = chave.split("/");
    const escala = buscarEscala(etapa, componente);
    const anteriores = faixasAnteriores(escala, 1); // só o nível 0 é anterior ao nível 1
    assert.equal(anteriores.length, 1, chave);
    assert.equal(anteriores[0].nomeNivel, nomeEsperado, chave);
  }
});

test("faixasAnteriores: funciona também em 2025 — a lista de níveis anteriores não depende da edição, só da escala e do nível atual", () => {
  // faixasAnteriores nunca recebe a edição — a própria assinatura da função garante isso — mas o
  // teste confirma que o caminho completo (resolver 2025 -> pegar a escala -> pegar os anteriores)
  // funciona de ponta a ponta para as seis combinações, sem regressão.
  for (const etapa of ["anosIniciais", "anosFinais", "ensinoMedio"]) {
    for (const componente of ["lp", "mt"]) {
      const estado = resolverPosicaoNaEscala({ etapa, componente, edicao: "2025", resultado: valor(999999) }); // topo de qualquer escala
      assert.equal(estado.tipo, "resolvido", `${etapa}/${componente}`);
      const anteriores = faixasAnteriores(estado.escala, estado.faixa.nivel);
      assert.ok(anteriores.length > 0, `${etapa}/${componente} deveria ter ao menos um nível anterior no topo da escala`);
      assert.ok(anteriores.every((f) => f.nivel < estado.faixa.nivel), `${etapa}/${componente}`);
    }
  }
});

// ---- linhasDaDescricaoSemIntroducaoOficial ----

test("linhasDaDescricaoSemIntroducaoOficial: remove a introdução oficial padrão do Inep quando ela é a primeira linha", () => {
  const faixa = { nivel: 2, descricaoOficial: "Além das habilidades anteriormente citadas, os estudantes provavelmente são capazes de:\n• Habilidade X.\n• Habilidade Y." };
  assert.deepEqual(linhasDaDescricaoSemIntroducaoOficial(faixa), ["• Habilidade X.", "• Habilidade Y."]);
});

test("linhasDaDescricaoSemIntroducaoOficial: remove também a variante do primeiro nível tabulado ('Os estudantes provavelmente são capazes de:')", () => {
  const faixa = { nivel: 1, descricaoOficial: "Os estudantes provavelmente são capazes de:\n• Habilidade única." };
  assert.deepEqual(linhasDaDescricaoSemIntroducaoOficial(faixa), ["• Habilidade única."]);
});

test("linhasDaDescricaoSemIntroducaoOficial: nunca remove uma primeira linha que não seja exatamente uma das duas introduções conhecidas", () => {
  const faixa = { nivel: 0, descricaoOficial: "O Saeb não utilizou itens que avaliam as habilidades deste nível. Frase qualquer." };
  assert.deepEqual(linhasDaDescricaoSemIntroducaoOficial(faixa), [faixa.descricaoOficial]);
});

test("linhasDaDescricaoSemIntroducaoOficial: nunca esvazia a descrição por completo, mesmo quando a única linha é a introdução", () => {
  const faixa = { nivel: 1, descricaoOficial: "Os estudantes provavelmente são capazes de:" };
  assert.deepEqual(linhasDaDescricaoSemIntroducaoOficial(faixa), ["Os estudantes provavelmente são capazes de:"]);
});

test("linhasDaDescricaoSemIntroducaoOficial: confirmado nas seis escalas reais — a frase antiga nunca sobra como primeira linha de nenhum nível > 0", () => {
  for (const etapa of ["anosIniciais", "anosFinais", "ensinoMedio"]) {
    for (const componente of ["lp", "mt"]) {
      const escala = buscarEscala(etapa, componente);
      for (const faixa of escala.niveis) {
        if (faixa.nivel === 0) continue;
        const linhas = linhasDaDescricaoSemIntroducaoOficial(faixa);
        assert.doesNotMatch(linhas[0], /^(Os estudantes provavelmente são capazes de:|Além das habilidades anteriormente citadas)/, `${etapa}/${componente} nível ${faixa.nivel}`);
      }
    }
  }
});

// ---- comPreposicao ----

test("comPreposicao: antepõe a preposição para nomes no formato 'Nível N'", () => {
  assert.equal(comPreposicao("o", "Nível 3"), "o Nível 3");
  assert.equal(comPreposicao("no", "Nível 3"), "no Nível 3");
  assert.equal(comPreposicao("o", "Nível 0"), "o Nível 0");
});

test("comPreposicao: omite a preposição para 'Abaixo do Nível 1' — evita a forma agramatical 'o/no Abaixo do Nível 1'", () => {
  assert.equal(comPreposicao("o", "Abaixo do Nível 1"), "Abaixo do Nível 1");
  assert.equal(comPreposicao("no", "Abaixo do Nível 1"), "Abaixo do Nível 1");
});
