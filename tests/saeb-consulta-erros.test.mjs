import assert from "node:assert/strict";
import test from "node:test";

import { SaebFetchError, SaebSchemaError, SaebVersionMismatchError } from "../lib/saeb/client.ts";
import { mensagemDeErro } from "../lib/saeb/erros.ts";

test("mensagemDeErro: cada tipo de erro do cliente tem uma mensagem distinta e específica, nunca genérica", () => {
  const mFetch = mensagemDeErro(new SaebFetchError("HTTP 500"));
  const mSchema = mensagemDeErro(new SaebSchemaError("schema ruim"));
  const mVersao = mensagemDeErro(new SaebVersionMismatchError("versão diferente"));
  assert.notEqual(mFetch, mSchema);
  assert.notEqual(mSchema, mVersao);
  assert.notEqual(mFetch, mVersao);
  assert.match(mVersao, /atualizados/);
});

test("mensagemDeErro: um erro desconhecido ainda produz uma mensagem explícita, nunca vazia", () => {
  assert.notEqual(mensagemDeErro(new Error("x")), "");
  assert.notEqual(mensagemDeErro("string crua"), "");
  assert.notEqual(mensagemDeErro(undefined), "");
});
