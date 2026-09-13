// Geração LOCAL da primeira versão pública da consulta do SAEB (Opção A).
//
// node scripts/saeb-query-prototype/publish-local.mjs [--limite-kib 50] [--cache <dir>]
// (ou: npm run saeb:publish-local)
//
// NÃO é executado por `npm test` nem por `npm run build` — processa os três
// pacotes oficiais inteiros (86.098 escolas) e leva minutos. É um comando
// manual, assim como `saeb:import`/`saeb:verify`.
//
// Fluxo, nesta ordem, cada etapa bloqueando a próxima:
//   1. Constrói o protótipo a partir do cache já validado (sem rede), com
//      versão embutida (comVersao: true — ver calcularVersaoDados).
//   2. Materializa em um diretório TEMPORÁRIO novo e isolado (materializar +
//      validarDestinoTemporario, inalterados desde a rodada anterior).
//   3. Roda a comparação semântica contra a referência normalizada do
//      importador. Só prossegue se o resultado for `ok: true` — qualquer
//      discrepância aborta antes de tocar em public/data/saeb.
//   4. Só então grava em public/data/saeb, pela função de escrita SEPARADA
//      (materializarPublico + validarDestinoPublico — nunca reaproveita a
//      validação de destino temporário).
//   5. Roda a comparação semântica DE NOVO, desta vez contra o que foi
//      efetivamente escrito em public/data/saeb — confirma que a cópia
//      pública é fiel, não só que o protótipo em memória estava correto.
//   6. Remove o diretório temporário (removal explícita e escopada ao próprio
//      mkdtemp — nunca uma limpeza recursiva genérica de outra coisa).
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  compararComReferencia,
  construirPrototipo,
  materializar,
  materializarPublico,
  medir,
  PrototypeError,
} from "./materialize.mjs";

function parseArgsCli(argv) {
  const flags = { limiteKiB: 50, cache: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--limite-kib") flags.limiteKiB = Number(argv[++i]);
    else if (arg === "--cache") flags.cache = argv[++i];
    else throw new PrototypeError(`argumento desconhecido: ${arg}`);
  }
  if (!Number.isFinite(flags.limiteKiB) || flags.limiteKiB <= 0) {
    throw new PrototypeError(`--limite-kib precisa ser um número positivo, recebido: ${flags.limiteKiB}`);
  }
  return flags;
}

async function main() {
  const flags = parseArgsCli(process.argv.slice(2));
  const cacheDir = path.resolve(flags.cache ?? path.join("data", "saeb", "source"));
  const limiteBytesGzip = Math.round(flags.limiteKiB * 1024);

  console.error(`[saeb-publish-local] construindo protótipo a partir do cache (${cacheDir}), limite ${flags.limiteKiB} KiB gzip...`);
  const inicioConstrucao = Date.now();
  const prototipo = await construirPrototipo({ cacheDir, limiteBytesGzip, comVersao: true });
  const msConstrucao = Date.now() - inicioConstrucao;
  console.error(`[saeb-publish-local] protótipo construído em ${msConstrucao}ms — versão ${prototipo.versao}`);

  const tempBase = await mkdtemp(path.join(os.tmpdir(), "saeb-publish-local-"));
  const outDirTemp = path.join(tempBase, "saida");
  try {
    console.error(`[saeb-publish-local] materializando em área temporária isolada: ${outDirTemp}`);
    const resultadoTemp = await materializar({ outDir: outDirTemp, prototipo });
    console.error(`[saeb-publish-local] área temporária: ${resultadoTemp.escritos}/${resultadoTemp.arquivos} arquivos escritos`);

    console.error("[saeb-publish-local] validando (comparação semântica) contra a área temporária...");
    const comparacaoTemp = await compararComReferencia({ referencia: prototipo.referencia, outDir: outDirTemp });
    if (!comparacaoTemp.ok) {
      throw new PrototypeError(
        `validação em área temporária falhou com ${comparacaoTemp.discrepancias.length} discrepância(s) — ` +
          `nada foi escrito em public/data/saeb. Amostra: ${JSON.stringify(comparacaoTemp.discrepancias.slice(0, 5), null, 2)}`,
      );
    }
    console.error(`[saeb-publish-local] área temporária válida: ${comparacaoTemp.municipiosVerificados} municípios conferidos, 0 discrepâncias`);

    console.error("[saeb-publish-local] gravando em public/data/saeb (função de escrita separada)...");
    const resultadoPublico = await materializarPublico({ prototipo });
    console.error(`[saeb-publish-local] public/data/saeb: ${resultadoPublico.escritos}/${resultadoPublico.arquivos} arquivos escritos em ${resultadoPublico.outDir}`);

    console.error("[saeb-publish-local] validando (comparação semântica) contra o que foi escrito em public/data/saeb...");
    const comparacaoPublico = await compararComReferencia({ referencia: prototipo.referencia, outDir: resultadoPublico.outDir });
    if (!comparacaoPublico.ok) {
      // Não deveria acontecer nunca (é o MESMO prototipo, só escrito num destino
      // diferente) — se acontecer, é sinal de um bug real na cópia pública, e o
      // comando precisa gritar alto em vez de reportar sucesso.
      throw new PrototypeError(
        `a cópia em public/data/saeb divergiu da referência mesmo após a área temporária ter validado — ` +
          `${comparacaoPublico.discrepancias.length} discrepância(s): ${JSON.stringify(comparacaoPublico.discrepancias.slice(0, 5), null, 2)}`,
      );
    }

    const estatisticas = medir(prototipo);
    console.log(
      JSON.stringify(
        {
          versao: prototipo.versao,
          limiteKiB: flags.limiteKiB,
          limiteBytesGzip,
          cacheDir,
          outDirPublico: resultadoPublico.outDir,
          escritosPublico: resultadoPublico.escritos,
          arquivosPublico: resultadoPublico.arquivos,
          ...estatisticas,
          tempoMs: { construcao: msConstrucao },
          comparacaoSemanticaTemp: { ok: comparacaoTemp.ok, municipiosVerificados: comparacaoTemp.municipiosVerificados, discrepancias: comparacaoTemp.discrepancias.length },
          comparacaoSemanticaPublico: { ok: comparacaoPublico.ok, municipiosVerificados: comparacaoPublico.municipiosVerificados, discrepancias: comparacaoPublico.discrepancias.length },
        },
        null,
        2,
      ),
    );
  } finally {
    // Remoção explícita, escopada exatamente ao diretório criado por mkdtemp
    // acima nesta mesma execução — nunca um rm -rf genérico de outra coisa.
    await rm(tempBase, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[saeb-publish-local] ${error.name ?? "Error"}: ${error.message}`);
  process.exitCode = 1;
});
