// Testes de lib/saeb/selection.ts — a condição de corrida em si, isolada dos detalhes de fetch do
// SAEB (esses ficam em tests/saeb-consulta-client.test.mjs). Usa promises controláveis manualmente
// (resolve/reject guardados fora) para forçar chegada FORA DE ORDEM de propósito.
import assert from "node:assert/strict";
import test from "node:test";

import { createSelectionController, eDescartado } from "../lib/saeb/selection.ts";

function deferido() {
  let resolver, rejeitar;
  const promessa = new Promise((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

test("createSelectionController: uma única chamada resolve normalmente", async () => {
  const controlador = createSelectionController();
  const resultado = await controlador.run(async () => "valor-a");
  assert.equal(resultado, "valor-a");
});

test("createSelectionController: a resposta da seleção MAIS ANTIGA é descartada quando ela resolve DEPOIS da mais nova (fora de ordem)", async () => {
  const controlador = createSelectionController();
  const antiga = deferido();
  const nova = deferido();

  const resultadoAntigaPromise = controlador.run(() => antiga.promessa);
  const resultadoNovaPromise = controlador.run(() => nova.promessa);

  // Resolve a NOVA primeiro, depois a ANTIGA — exatamente o cenário de "resposta fora de ordem"
  // que uma rede real pode produzir (a requisição antiga demora mais que a nova).
  nova.resolver("valor-novo");
  const resultadoNova = await resultadoNovaPromise;
  assert.equal(resultadoNova, "valor-novo");

  antiga.resolver("valor-antigo-atrasado");
  const resultadoAntiga = await resultadoAntigaPromise;
  assert.ok(eDescartado(resultadoAntiga), "a resposta antiga, mesmo tendo resolvido, precisa ser descartada");
});

test("createSelectionController: a tarefa antiga recebe um AbortSignal abortado quando uma nova seleção começa", async () => {
  const controlador = createSelectionController();
  const antiga = deferido();
  let sinalDaAntigaAbortado = false;

  const resultadoAntigaPromise = controlador.run((signal) => {
    signal.addEventListener("abort", () => {
      sinalDaAntigaAbortado = true;
    });
    return antiga.promessa;
  });

  await controlador.run(async () => "valor-novo");

  assert.equal(sinalDaAntigaAbortado, true);
  antiga.resolver("nunca deveria importar");
  const resultadoAntiga = await resultadoAntigaPromise;
  assert.ok(eDescartado(resultadoAntiga));
});

test("createSelectionController: uma tarefa antiga que REJEITA depois de já estar obsoleta não lança — é descartada silenciosamente", async () => {
  const controlador = createSelectionController();
  const antiga = deferido();

  const resultadoAntigaPromise = controlador.run(() => antiga.promessa);
  const resultadoNovaPromise = controlador.run(async () => "valor-novo");
  await resultadoNovaPromise;

  antiga.rejeitar(new Error("falha de rede tardia"));
  const resultadoAntiga = await resultadoAntigaPromise;
  assert.ok(eDescartado(resultadoAntiga), "uma rejeição obsoleta não pode se tornar um erro visível para o usuário");
});

test("createSelectionController: uma tarefa que rejeita e AINDA é a mais recente propaga o erro normalmente", async () => {
  const controlador = createSelectionController();
  await assert.rejects(
    () => controlador.run(async () => { throw new Error("falha real"); }),
    /falha real/,
  );
});

test("createSelectionController: cancelar() descarta a seleção em voo sem iniciar uma nova (limpeza de seleção dependente)", async () => {
  const controlador = createSelectionController();
  const antiga = deferido();
  const resultadoAntigaPromise = controlador.run(() => antiga.promessa);

  controlador.cancelar();
  antiga.resolver("valor-atrasado");

  const resultadoAntiga = await resultadoAntigaPromise;
  assert.ok(eDescartado(resultadoAntiga));
});

test("createSelectionController: três seleções rápidas em sequência — só a última conta, mesmo com atrasos variados", async () => {
  const controlador = createSelectionController();
  const a = deferido();
  const b = deferido();
  const c = deferido();

  const resultadoAPromise = controlador.run(() => a.promessa);
  const resultadoBPromise = controlador.run(() => b.promessa);
  const resultadoCPromise = controlador.run(() => c.promessa);

  // Ordem de chegada deliberadamente embaralhada: b, depois a, depois c.
  b.resolver("b");
  a.resolver("a");
  c.resolver("c");

  const [resultadoA, resultadoB, resultadoC] = await Promise.all([resultadoAPromise, resultadoBPromise, resultadoCPromise]);
  assert.ok(eDescartado(resultadoA));
  assert.ok(eDescartado(resultadoB));
  assert.equal(resultadoC, "c");
});
