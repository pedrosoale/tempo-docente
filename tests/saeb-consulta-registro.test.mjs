// Testes puros de lib/saeb/registro.ts — nenhuma rede, nenhum arquivo, nenhum pacote oficial.
import assert from "node:assert/strict";
import test from "node:test";

import { edicoesDisponiveis, etapasDisponiveis, formatarValorIndicador, resolverIndicador } from "../lib/saeb/registro.ts";

function escola(etapas) {
  return { codigoInep: "12345678", nome: "Escola Teste", rede: "Estadual", etapas };
}

test("etapasDisponiveis: só lista etapas que a escola de fato tem, na ordem canônica (não a de inserção)", () => {
  const e = escola({ ensinoMedio: { 2025: { lp: 250 } }, anosIniciais: { 2025: { lp: 200 } } });
  assert.deepEqual(etapasDisponiveis(e), ["anosIniciais", "ensinoMedio"]);
});

test("etapasDisponiveis: escola sem nenhuma etapa devolve lista vazia (nunca lança)", () => {
  assert.deepEqual(etapasDisponiveis(escola({})), []);
});

test("edicoesDisponiveis: lista só as edições com ao menos um indicador, em ordem crescente", () => {
  const e = escola({ anosIniciais: { 2025: { lp: 200 }, 2019: { lp: 190 }, 2021: { lp: 195 } } });
  assert.deepEqual(edicoesDisponiveis(e, "anosIniciais"), ["2019", "2021", "2025"]);
});

test("edicoesDisponiveis: etapa ausente devolve lista vazia — distinto de uma etapa presente sem edições", () => {
  assert.deepEqual(edicoesDisponiveis(escola({}), "anosIniciais"), []);
});

test("edicoesDisponiveis: etapa presente mas sem nenhuma edição com dado (caso limite do formato) também devolve vazia, sem lançar", () => {
  const e = escola({ anosIniciais: {} });
  assert.deepEqual(edicoesDisponiveis(e, "anosIniciais"), []);
});

test("resolverIndicador: valor numérico, incluindo zero — nunca convertido em ausência", () => {
  assert.deepEqual(resolverIndicador({ lp: 0 }, "lp"), { tipo: "valor", valor: 0 });
  assert.deepEqual(resolverIndicador({ mt: 187.34 }, "mt"), { tipo: "valor", valor: 187.34 });
});

test("resolverIndicador: valor negativo também é preservado como valor — nunca reinterpretado", () => {
  // O dataset real não deveria produzir negativos, mas a função não pode silenciosamente
  // "corrigir" um número só porque é inesperado — isso seria inventar um comportamento.
  assert.deepEqual(resolverIndicador({ lp: -1 }, "lp"), { tipo: "valor", valor: -1 });
});

test("resolverIndicador: valor com observação de avaliação estadual preserva o texto oficial", () => {
  const resultado = resolverIndicador({ lp: { valor: 187.89, obs: "avaliacao_estadual" } }, "lp");
  assert.equal(resultado.tipo, "valor");
  assert.equal(resultado.valor, 187.89);
  assert.match(resultado.observacao, /avaliações estaduais/);
});

test("resolverIndicador: os cinco estados oficiais de ausência resolvem com o motivo oficial correspondente, nunca um motivo inventado", () => {
  const casos = [
    ["nao_divulgado_material_extraviado", /material extraviado/],
    ["nao_divulgado_a_pedido", /solicitação da Secretaria/],
    ["nao_divulgado_por_norma", /Portaria Inep/],
    ["participacao_insuficiente", /participantes no SAEB insuficiente/],
    ["ausente", /etapa não avaliada/],
  ];
  for (const [estado, padraoMotivo] of casos) {
    const resultado = resolverIndicador({ lp: { estado } }, "lp");
    assert.equal(resultado.tipo, "ausente_oficial");
    assert.equal(resultado.estado, estado);
    assert.match(resultado.motivo, padraoMotivo, `motivo incorreto para ${estado}`);
  }
});

test("resolverIndicador: campo ausente dentro de um registro existente é 'não informado', distinto de um estado oficial de ausência", () => {
  const resultado = resolverIndicador({ mt: 200 }, "lp");
  assert.deepEqual(resultado, { tipo: "nao_informado" });
});

test("resolverIndicador: registro inteiro ausente (edição sem dados) também é 'não informado'", () => {
  assert.deepEqual(resolverIndicador(undefined, "lp"), { tipo: "nao_informado" });
});

test("formatarValorIndicador: usa vírgula decimal (pt-BR) e preserva zero", () => {
  assert.equal(formatarValorIndicador(0), "0");
  assert.equal(formatarValorIndicador(187.5), "187,5");
});
