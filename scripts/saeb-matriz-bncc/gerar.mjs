// Gerador determinístico do catálogo da matriz de referência do SAEB ALINHADA À BNCC — Linguagens/
// Língua Portuguesa e Matemática, nas etapas 2º/5º/9º ano do Ensino Fundamental (não há 3ª série do
// Ensino Médio nestas duas publicações — ver notaDocumental de cada fonte). Mesmo padrão de
// scripts/saeb-descritores/gerar.mjs: uma única lógica de geração (`gerar`, abaixo) e dois modos:
//
//   node gerar.mjs           gera e grava data/saeb-matriz-bncc/matriz-linguagens-matematica-bncc.json
//   node gerar.mjs --check   gera em memória (nunca escreve) e compara byte a byte com o arquivo já
//                            versionado — ver `verificar()`.
//
// O arquivo-fonte (data/saeb-matriz-bncc/source/official-inep-matrizes-bncc.json) reproduz o
// inventário da Rodada 9 do relatório do piloto (C:\ProjetosIA\saeb-descritores-relatorio.html) —
// 262 habilidades (114 Linguagens + 148 Matemática), cada uma lida e conferida visualmente contra a
// imagem renderizada da página do PDF oficial (nunca contra o texto extraído automaticamente: os
// PDFs do Inep usam um mapa de caracteres não padrão que corrompe o verbo inicial de muitas
// habilidades de Linguagens — ver a seção "Trechos inicialmente corrompidos" do relatório). O hash
// SHA-256 de cada PDF foi calculado sobre os bytes baixados de download.inep.gov.br.
//
// ÁRVORE PRÓPRIA (data/saeb-matriz-bncc/), deliberadamente separada de:
//   - data/saeb-descritores/  (matriz TRADICIONAL de 2001 — códigos "D<n>", outra estrutura)
//   - data/bncc/              (base curricular completa da BNCC — outro documento, outra origem)
//   - data/saeb-escalas/      (escalas de proficiência — não são matriz de referência)
// Nunca misturar estas quatro estruturas (ver comentário de topo de lib/saeb/matriz-bncc.ts).
//
// DUAS ESTRUTURAS DE CÓDIGO, NUNCA UNIFICADAS:
//   - Linguagens: NENHUM código oficial existe — cada habilidade é identificada só pela posição na
//     tabela (eixo do conhecimento × eixo cognitivo × ordem local dentro da célula). `codigoOficial`
//     é sempre `null` aqui; a "ordem editorial" usada para desambiguar NUNCA deve ser tratada como
//     código do Inep.
//   - Matemática: todas as 148 habilidades têm código oficial no padrão "<etapa><Eixo><eixoCognitivo
//     1|2>.<sequencial>" (ex.: "9G2.7") — um esquema PRÓPRIO desta matriz, que não reaproveita nem se
//     parece com os códigos "D<n>" da matriz tradicional. A regex de validação abaixo rejeita
//     explicitamente qualquer código no formato "D<n>".
//
// ESCOPO: só Linguagens/Língua Portuguesa e Matemática — as matrizes BNCC de Ciências da Natureza e
// Ciências Humanas (confirmadas como existentes na Rodada 9, mas não auditadas) NÃO são importadas
// aqui. Nenhuma aplicação da matriz de Linguagens/Matemática em 5º/9º ano numa edição específica do
// Saeb é afirmada — ver `situacaoAplicacao` em cada fonte, que registra isso como inconclusivo.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serializar } from "../saeb/lib/normalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const FONTE_PATH = join(REPO_ROOT, "data", "saeb-matriz-bncc", "source", "official-inep-matrizes-bncc.json");
const SAIDA_PATH = join(REPO_ROOT, "data", "saeb-matriz-bncc", "matriz-linguagens-matematica-bncc.json");

export class MatrizBnccGeracaoError extends Error {
  constructor(message) {
    super(message);
    this.name = "MatrizBnccGeracaoError";
  }
}

const HASH_HEX_64 = /^[0-9a-f]{64}$/;
const DOMINIO_OFICIAL_INEP = "inep.gov.br";
const ETAPAS_VALIDAS = new Set(["2anoEF", "5anoEF", "9anoEF"]);
const COMPONENTES_VALIDOS = new Set(["linguagens", "matematica"]);

/** Código oficial da matriz Matemática–BNCC: <etapa 2|5|9><Eixo 1-2 letras><eixoCognitivo 1|2>.<seq>.
 * Deliberadamente incompatível com o padrão "D<n>" da matriz tradicional. */
const CODIGO_MATEMATICA = /^[259][A-Z]{1,2}[12]\.\d{1,2}$/;

/** Dígito inicial do código esperado para cada etapa — permite validar SEMANTICAMENTE que o código
 * bate com a etapa da própria habilidade, não só com o padrão sintático da regex acima (que aceita
 * "2", "5" ou "9" em qualquer posição, sem saber qual etapa está sendo validada). */
const ETAPA_DIGITO_MATEMATICA = { "2anoEF": "2", "5anoEF": "5", "9anoEF": "9" };
/** Letra do código esperada para cada eixo do conhecimento de Matemática — permite validar
 * semanticamente que a letra do código corresponde ao `eixoConhecimento` declarado (não só que a
 * letra existe em algum lugar do vocabulário A-Z). */
const EIXO_LETRA_MATEMATICA = { Números: "N", Álgebra: "A", Geometria: "G", "Grandezas e Medidas": "M", "Probabilidade e Estatística": "E" };
/** Dígito cognitivo esperado para cada eixo cognitivo de Matemática. */
const COGNITIVO_DIGITO_MATEMATICA = { "Compreender e aplicar conceitos e procedimentos": "1", "Resolver problemas e argumentar": "2" };
/** Nunca aceitar um código no formato da matriz tradicional, mesmo que apareça por engano num campo
 * de Matemática desta matriz BNCC — as duas estruturas de código nunca podem se confundir. */
const CODIGO_MATRIZ_TRADICIONAL = /^D[1-9][0-9]*$/;

const EIXOS_COGNITIVOS_LINGUAGENS = new Set(["Reconhecer", "Analisar", "Avaliar", "Produzir"]);
const EIXOS_COGNITIVOS_MATEMATICA = new Set(["Compreender e aplicar conceitos e procedimentos", "Resolver problemas e argumentar"]);

/** Eixos do conhecimento oficiais de Linguagens — variam por etapa (conferido visualmente na Rodada
 * 9): só o 2º ano tem "Apropriação do Sistema de Escrita Alfabética"; só o 9º ano tem "Língua
 * inglesa". Um eixo fora desta lista para a etapa é rejeitado, nunca aceito por soar plausível. */
const EIXOS_CONHECIMENTO_LINGUAGENS_POR_ETAPA = {
  "2anoEF": new Set(["Apropriação do Sistema de Escrita Alfabética", "Leitura", "Produção textual"]),
  "5anoEF": new Set(["Leitura", "Análise linguística/Semiótica", "Produção de textos", "Arte", "Educação física"]),
  "9anoEF": new Set(["Leitura", "Análise linguística/Semiótica", "Produção de textos", "Arte", "Educação física", "Língua inglesa"]),
};

/** Eixos do conhecimento oficiais de Matemática — as mesmas cinco "unidades temáticas" nas três
 * etapas (confirmado contra Documentos de Referência v1.0, página real 78: "cinco unidades
 * temáticas preconizadas pela BNCC"). */
const EIXOS_CONHECIMENTO_MATEMATICA = new Set(["Números", "Álgebra", "Geometria", "Grandezas e Medidas", "Probabilidade e Estatística"]);

/** Contagem exata de habilidades por (componente, etapa) — conferida visualmente na Rodada 9 do
 * relatório do piloto, reconciliada em duas/três vias independentes lá. Literal e independente do
 * arquivo-fonte: nunca derivada dele. */
const CONTAGEM_ESPERADA_POR_ETAPA = {
  "linguagens/2anoEF": 10,
  "linguagens/5anoEF": 47,
  "linguagens/9anoEF": 57,
  "matematica/2anoEF": 33,
  "matematica/5anoEF": 56,
  "matematica/9anoEF": 59,
};

const TOTAL_ESPERADO_LINGUAGENS = 114;
const TOTAL_ESPERADO_MATEMATICA = 148;
const TOTAL_ESPERADO_GERAL = 262;

/** Contagem exata por eixo do conhecimento, dentro de cada (componente, etapa) — mesmo raciocínio de
 * validarGruposOficiais em scripts/saeb-descritores/gerar.mjs: comparar o CONJUNTO/contagem exata por
 * eixo detecta uma habilidade arquivada sob o eixo errado, o que só olhar o total da etapa não
 * detectaria (dois eixos do mesmo tamanho poderiam trocar uma habilidade sem mudar o total). */
const CONTAGEM_ESPERADA_POR_EIXO = {
  "linguagens/2anoEF": { "Apropriação do Sistema de Escrita Alfabética": 3, Leitura: 6, "Produção textual": 1 },
  "linguagens/5anoEF": { Leitura: 16, "Análise linguística/Semiótica": 10, "Produção de textos": 1, Arte: 10, "Educação física": 10 },
  "linguagens/9anoEF": { Leitura: 17, "Análise linguística/Semiótica": 9, "Produção de textos": 1, Arte: 10, "Educação física": 10, "Língua inglesa": 10 },
  "matematica/2anoEF": { Números: 11, Álgebra: 4, Geometria: 4, "Grandezas e Medidas": 10, "Probabilidade e Estatística": 4 },
  "matematica/5anoEF": { Números: 16, Álgebra: 8, Geometria: 11, "Grandezas e Medidas": 12, "Probabilidade e Estatística": 9 },
  "matematica/9anoEF": { Números: 15, Álgebra: 13, Geometria: 18, "Grandezas e Medidas": 4, "Probabilidade e Estatística": 9 },
};

/** Contagem exata por eixo cognitivo, dentro de cada (componente, etapa) — Linguagens 2º ano não usa
 * eixo cognitivo (fica de fora deste mapa; validado separadamente). */
const CONTAGEM_ESPERADA_POR_COGNITIVO = {
  "linguagens/5anoEF": { Reconhecer: 23, Analisar: 18, Avaliar: 5, Produzir: 1 },
  "linguagens/9anoEF": { Reconhecer: 17, Analisar: 26, Avaliar: 13, Produzir: 1 },
  "matematica/2anoEF": { "Compreender e aplicar conceitos e procedimentos": 25, "Resolver problemas e argumentar": 8 },
  "matematica/5anoEF": { "Compreender e aplicar conceitos e procedimentos": 36, "Resolver problemas e argumentar": 20 },
  "matematica/9anoEF": { "Compreender e aplicar conceitos e procedimentos": 34, "Resolver problemas e argumentar": 25 },
};

/** Contagem exata por eixo do conhecimento de Matemática, somada nas três etapas — segunda via de
 * reconciliação independente da Rodada 9 (42/25/33/26/22, soma 148). */
const CONTAGEM_ESPERADA_POR_EIXO_MATEMATICA_TOTAL = { Números: 42, Álgebra: 25, Geometria: 33, "Grandezas e Medidas": 26, "Probabilidade e Estatística": 22 };
/** Contagem exata por eixo cognitivo de Matemática, somada nas três etapas — terceira via (95/53, soma 148). */
const CONTAGEM_ESPERADA_POR_COGNITIVO_MATEMATICA_TOTAL = { "Compreender e aplicar conceitos e procedimentos": 95, "Resolver problemas e argumentar": 53 };

/**
 * Conjunto EXATO de hashes SHA-256 (ver `canonicalizarHabilidade`) das 262 habilidades aprovadas —
 * um por registro, calculado uma única vez a partir do catálogo já revisado (Rodada 10, correção
 * pós-revisão independente) e congelado aqui como constante literal. Nunca recalculado a partir do
 * arquivo-fonte durante a validação (ver uso em `gerar()`) — é isso que torna esta verificação
 * independente da entrada, ao contrário de uma contagem por eixo (que uma troca simétrica preserva).
 * Atualizar esta lista é uma AÇÃO DELIBERADA, feita só depois de reconferir visualmente contra o PDF
 * qualquer habilidade cujo texto, código, eixo, página ou ordem tenha mudado — nunca para "destravar"
 * uma validação que está furando por engano de transcrição.
 */
const HASHES_APROVADOS = [
  "0171e15dcf90e57bd0bec7df599d72516e80e46df9f8cb36733c6024c3f699c3", "03c86dca9708fb71850bb952dc6e12a4248269141100285dbf48f4533c39e054", "0538dcb17045f2902863bc67e4b306a02a59cdede408a7ef8e7f78b32f60ccf6", "05d55f8b6410cdf370fb1cf33fd3399864e832e0ee520905a7f31fa46d05d861",
  "079de690206b7a6ebf8a7022efa51014b48358da1a8aec3357c9496b7a6a482d", "0847da75d49db28563639bd60cafad00254df80b991f114dd61c498433e21010", "0918b5c2ccd698e3fe4ac63e020decc26d9b36de76895b7105f8a3e8165e5d4b", "0987564e060d22f2e0d7352b24555c9b8f64c95cf788a80f2884ac25111343b9",
  "0a9b48dfd03bcb131ced449fbc4e883dbf482463812c5d532893359686c3e111", "0b387011af2ef3b6406b214655f335ef1e81f578d28d1957228732c1ebd8ee51", "0c12bacdd61c50a46ac1fdfd8dceefd2fd455019e4f13c87998fa3875b283c33", "0c34d147b7d923ff5ce22875904bdd0fff0cac6ffbbee7e1d300e84dbdb4242f",
  "0c8322cdc9a8282c0558e14ca4eb3c044c7d952a6d2048766a0a1c52dee60ca0", "0cf7f3a7838d8f38c696739794fd1c8c608cc070973aa585e8ecafd3812d4004", "0f573f021165d75c751d43e171ff7632f223e4dbe89464c157719a7ee2ff96db", "0f8af8711b77c403a0c0accd7c335f6abda7ec91b5bb0cf93d0617e787df7f67",
  "10656fcea9c7e946cff53b6755c0cba290c6f2bc8a669aba47942312387963f6", "10a03dd4802bc43ccdb8a04e2449938ec83b357aee1d50fe5833133d731205b6", "125043fc8c129eab075ea26f230d0637d13632056b69588ae7dc91a9d3bec93f", "15f171fd4c9b5846c8a076d2d6addca74235c3bc5b53ce82b876f6033ef9be47",
  "161544d647e0949d831aa074f80e413026b186274bb5064f4e5404a2e148a2d8", "187e491ffa538edca336635ae31f0597f7727506eb5014d8b0a393393fb91cf4", "18eae6db757fafe955298a098f8a049903b157847bbee75d8a31b873fe7341fa", "1c4d0962ded4d34ad8885d66a6064a56206d2efc7131dcab49c5feba244a2afd",
  "1c4d4c7eabdb35cf5b035bdf49137d399d4fa6818cf79e594e36f3c66655b0b0", "1cd45faf3cc757445fc91647407149277e0002e682b7e831102e20367962ddab", "1dca980dd2345b76bd7699eb314bd9ebfd0b88b0a20526957a845cedf672b2d8", "21b2586d38ac89823cb939eb134ee9ea22df9fa732588c1cd6621d4a319fb694",
  "21bc3d0ce34ebe76c440786b0f430c389845038115245c5e88a1e8a2e5f84c85", "229bfd20845a711d76e25ea8183879a8df26bcfa6e61794183a5b86868dbc1c5", "2422600cb98f87516bf3a6453baf2a8a6ad6afa376d31cba682236073d9a55b9", "24da359e8df75fd8d6263d6fa8d3392b043793308fc54048e66f04eb1341f97d",
  "251152bcd9bef5ac91a79b9dc5d792526d36cc05b17baa2f9fbf41e5d0227bbb", "25e2d4591a390efb4e103458a3eb4dc797b6cdc9c13a21904cd7fdd9bc2df85c", "2cba6504b17072a26cc4908e5b4531336eb8e22fa1edbcaff6867faf27274754", "2d60abd60d50b697856438e0079919d8929a27c870077d232dc331751b2e5d0f",
  "2d8886abc8c16b44201f868122389a14e829e3930f4513e73d43bdb8cdb468ec", "2e0695dd1f700898ba3ec3766f9368c10369c6baac0cf0212f0f04555376d643", "2ef12522e21c86bd614fa610297d285a66affed5ee5165d628aa5446c2df895e", "302eff748c56db5a355e33828af9c7d126f5286abc85d5e97ed7241e05d98823",
  "303811e12da30022f8c34d11ae5db759961ee8b18995296ca767f18f5763413a", "31acf770fbb5793a19464a9c5c3346e1ea6c96c71527a1ef1b73e729d6b8857d", "31d344daa22d2429fdb9b1f8bfbaeca4be656f0bc1a3e68ae4538b65ed637927", "322cdbc9375eef9e89db9139726abbcd81e51c397a54fe02b9f31a3d0c27e8ad",
  "323d62b6e3b7c3f3692c989166a27ccca6ca4654a7bb93832dc1c1c2bfa68f76", "34e5d3a2a87041bf98df02b49e003c5f7b6aeb09599c5e2e698e14c4ff8675a7", "35055b53a61a4b1cfdd395648292f6ad623297efe1ba08500021d23d53e0bf11", "35cea3d3d433b1be3e9a55f5bee1121e47fc77c8a10b923ef4fc4371a74b50df",
  "36c56c439a6c586abf8be96e9db2e47832af833651447b16eb9ab1aa62a794b4", "36cd1ab3afe3d3413531c17b77dbf658779bb59265839f3314774189a266c43b", "393d6a3f4559db35153cfdf345d2271d374ec0aa155090480c689bd958a35bb6", "39691843c4e7f593986b94d699881ff814578b13ecb30f24339618812756800a",
  "3d918d0b6d1cce11de80e7e53fc2ad1256385c21ccd5ca8093f130add07d9a1f", "3e7ac630cb8702afc475d2979010c49989163c1fca392c18d3304f80fc996d36", "406173e45d49f5c5091bb5e75db6be1106df49eb302ff1489f0f161f3c306bbd", "4159a1a23c1128d9389963db41ed02ed0dcd1022369b0a9874ffce8d53553521",
  "41ac137b469a2e642e5a69b5d92b819be852986ddb0aabf4dc163df9118f35c9", "4283e73ac61454ee53a24ec24b45d3fb70c50b91143a1ea567ebb7eafbbb7d8b", "44a2ba9e7769c35aabdba56c54150980f6c1376a49aa3610e45615c0ae3efb50", "4534f2425501c28aa6e0710c7a4bb8c6d2d4b37ad818b9e8008e7d163a7c4fed",
  "46b188e5df19c05a971647d0ee315ed626f315522334df0a3b2b6ecaa34c414c", "48cdf66ef48c5fb965252405a12c94d574d9891b3d540b6c92bc8590f61a3e78", "492f27d8ebd377abb972cd0589a4eed7f5d08bfc084ffa7004a2c6864a108e7a", "49337f3596634e1fb97b66a92412e8c26672a1bc401ec8b33705e95108044823",
  "49f4364011b2f4274379467171c1f0edd8e2d560c6308b6249233391b5f06710", "4ba558e7b873b8803078f22b35cd4620c373e7c1f569f439e9d6b6be8051b875", "4c317fad791be012edd5b9826b797f4837c71e40c938b0c9fd2e2a18f423b08c", "4c770f09c0c6ca573cad679805ad0783d59456c5c39b185d2f0c5d4ad3840c5b",
  "4cee8a6c32964f830fbb29e6bfdb918a0e49832f6d7900e9af5ed92a53ea8834", "4dfd498c20159895df4c81c864e3288e3c9027d958c3258709a9ca2cb56108ec", "4e1bf8f846fcf0284c402735433837e46d2de0b295281f9e25ef37a13ed63b10", "4ea18ad963a61af568f05c31d43fd3daec40e4458326a39af33f47d0b6f8f343",
  "4ea8ba0a0628c2360a67b8a73ee2b4491a7eda8bed5cb83c60c5eaefad4cae41", "4eed4c75a8f0bf9548c67468d78faf03e078154e61126c26e33f731fa485afbe", "4f5d27d439766b0e30ffaa74012df4c46f72dd860d0312c48c52ea06d0bccb35", "4ff6268a6c27536a276fa3fad857f23d0773183e3773c5d0caa7a52b74ddea1d",
  "512fccb63e2f9e7ed325583c4a1d3f94d788491e610dc8327a8302e3d3b165d1", "52ef717230e0f528c835ec1853afb36798f271fe661e1e1c896be23ce9a50f06", "531c87c055e384a1e7cf58db4b8f8f935ff2ed27002bc4ed38d4f1a1029bd947", "551253332f53506ef754ba425c4cfcd37242906cf925b488a47e793ce4afb975",
  "5520ba4d323a2f7297d00b0bf934888510cac14cabf90a6b53a1789ffb47e05b", "5609bc57ef81b0e7a46f7fa38a4539dca271c672fa8ba68d4a75efe5437ab937", "561154f7a40a9d75eec7ae25e8a43b09c82f49455c7ffec03f80d33cfe378797", "562988996da3b73bc0ec8d47d84a49a8ce811867833620787db4b3e400c3a684",
  "56f30bbd969c88dc79c815eb014edc703a43d72c3cd781b38e06d7f19d418459", "57cd72d5dd37de408d4f05b76a6c853feb13e2356dff4e9a85d7474622b92634", "5942576096096847a50c2d0cbde8ccbcefa079b84a3613b5aefea1b458fc94a7", "5aea13adb2b558dbc6b76d8b9ba5a90eb3f0c5ddc08a5c5edf2ba2bffd9dc392",
  "5b14d7134631dc1b191ae86e5510f0c5f9f20ba2a72769b4951c38f5406ecafa", "5b9cde060d89b13ce36207f2e001690dc4b11b110da8dbc83ccba672587559fe", "5c041564fb793d482c40463c0fe7cccc614943c52f1406979d7b55833384342c", "5c7003523fb7e54ce8d482d31ea2893517ab0f87fa218dcdb527d5154647eabe",
  "5dea9b636ac8b03912510e23855c898a09234b405e5cfc75e88a530299516829", "5eb5fa9f254d585c4bcd9c339d14a861d30a6421d0064fd6b967a12f15f2145b", "5f1ea98d743b6bc550aa738da44ee946c5501919669aa50231dbc352d4f0ce49", "60055a0be5c0bbfe07a6008e8613b28b63bc99fd04984e37f35fd6043d4aa833",
  "628def87d215d0d113164a91e594eb7b2871e316c977c3605805138249b9ee8c", "62c1aecb5f200a4a89c3872155480ff16c6269c3ae7b0358cc73634a681802b4", "652248eb16fa52761c09225ddfc771f75c3362cb8d40ca4ed031033e14bf6dda", "6559ac05c05c0cb9c50f66284805d968a78b5b9dda52771289c43e9260395264",
  "656f6a61e81fd741bb45a92125bcbc59a6dad35e5d958f5240c49ef6a361121c", "6581fe161c1221edd23004abe7ce40ac330f0423e22ce3b4e36474203767c188", "663411e206da8c6d36d21b95c92f305e7e99887694e1a3947756688d37cc42dd", "66ecc2d112deac1f2eea4a64530d43db6182aab1c5be47d328cab87fbf615007",
  "6757c8a60e4a2d29363c2180d6f8cc9306fb95a768c2dd85041e3b64cef663c1", "6981a5626c0acf14f8ad77de0c4578c45fa0b4a7dfee5594cd0a10e966e1af79", "6a36bfa6f8d0294a937d8a3677f3470a4e2d3d45f83bfa6d4d1ae587b66fa9f8", "6abbddaabd8d4bd2a3381988fd38c84f6cd43cd4511a51230bff3efbd1c405fa",
  "6d4a424beada151979d2f9519523af6651e9f9ff8960999c50117f0744f4132f", "6d717ead7b89c42de903a9e20f6e9e8f48146d8b4d9eaa5bf284f92944a7803e", "6ed045acfc18522984f092e968bdb6450e0dea23ef935da177f42b7f6f1b6fee", "6f33322ed758e9ded6769f8bc31e520d84438dae34114e8e8307ca19fd05e296",
  "6feb82bbd14776c3366eda4151a00abde0126fd8c2bb6d7801e6a7bcf50e04b9", "7006cbd0887ee9b9eb244c45fc669b6c17f496eac74fe2be12e2537d6a462966", "70899a02510462c16f882f291ee69bae55eb26f37150335e83ec2a0319c0447e", "7292a7be481cb77f26aac467fc55629e893932941474ad99cdbeabca859b818b",
  "747c202ad3d63ab502d75a1a8d6f533cdc086d55863e2ccb844c149341ab1685", "7506faeeece6c95c3161d53f85ac0f57de32629bfa6dc32783c85e294cfb69d8", "7554e7cbc268e93d6a91678d9c4312dc703cfa04780a21a18f9a6bbb68038730", "75c0ba769b567ef442577fb2e9ad6a0f41e8500fd09aec490b43b7859814a797",
  "79367113a4abffce9f0d114f347ed081d1a5d8fa8e37a0a1ad8c2cec136d24c2", "7a3162ce94d9336182c298f0edadf6145612a1deecb381a93c2318fb22b120af", "7b87d79764a72ca8bd637f126f4f9733f497f878a4739f7b5f16cc00cfb73192", "7c9c4108abd203a7aa4ccd7260f21292b21087c53993d3bc223a61e631e93d81",
  "7ca616a9c484e3fc7385568c479b1d3e403472b257b08f71711342b29ed215a5", "7d1880a19df1b6358636552273548c161a67fa3f8de0bfc9b7206c70062c248a", "7d7451f9b5bd500bc327301bae9d2e26bc7cc7a720c9183fc5ccc877df74e44b", "7fd15aad2be5751e6fd20e376f7343e1a94dafa4aa07eb32f811d642cf0ab48e",
  "81e8a9b8188cdc553e7a8262dff7495933d8f6d0655ff452a84bd1ef300f45c2", "82a4a4c12afa1009512752e608482ae93ee1f8b464232b83fe36326c905c8adc", "82f63ea4b6dcfd14d4a168780090725747c27dd37d5150b37e1ffacb6e534d82", "839864f608b1ebb001bd4f655a0bdcfacf1f01c2070b85f03fa67df710586e88",
  "88b1525155ea720f5f14c9c6c5c010865a2ace0637273e71e510c59fba9bdba6", "890e6f5e9f36d77257904b93411f9110c037a98948ed5c3bb24b76da9c41a1bd", "89b0f4ad18eb126d35515598a7fb03be902e0af33e92583762e9c9cea9071de4", "89c565a58bdeb19e4ffb02561651da67b1c031abe17cba0798aa52db1f0fe534",
  "8a0168e00092a23e5d924d4142fdec5f3f208932ad3992e2abe1028faed60bf3", "8a030b01fa52426563e12081954f33e3f686d3f0a219e42b81566de7088df116", "8a0343c82d2c6d414b2cb3e61867625517aa5330f736eb3cddd5b16c7ea5e31b", "8a4a199f65bbaf44149ae788e0e69281719057b32d3df74713892efcf2928409",
  "8ab3a7e0e6385332a45c5647becde6de64d80d8f6df71cd11284ecd6241469e5", "8b611d836abc826a6906e2b0dd91b3a1370e0d4ae474207e8413bef8c8083c48", "8cad3b66a2f290a87b6b1f3f6bcbe964554e81f8f2c22d8e1538a539488fbf18", "8d2151600cf63f4852547d0384f47a60f0f0d75f8cfccf31ae81e5fe37ef207b",
  "8dcc707d8b16d14fb1cb1551fe861286f0ca4f94e4e76fbcd2f86b027102486c", "8dfff4e224e3b95edee1c3b46213849f20ec315d0b46db331ce188cc93718080", "8e2a53cd547b60435ce99462a480a816abe37d51a9c8c2946621881e3e3a466a", "8fa9d6b068e5ecb8684d9c0ed5e5c8682ce247979764c401735e9f46ea4245ad",
  "90a06ae8c03d76ca17f40c1bfa4bdaa524eca980dcfeb5591996701563359cf0", "931f78c9821a3fcae7188bf8a876bd3838ad318759570368db18a7eefd4bd04a", "94a2cb95295f43e7df26c45f8ae15a16ab4835473ed3c46cbae5cd2c5ba43c3a", "94f615241a5566105e364545d5194a95a7053ef019e2c5548ce4f08cf1184333",
  "9527b81455c0ef1990af2468152c0fea898525c629ab240a36b0e7c9d30a0247", "953b45747bf4d6b6c34d89d491a683c55ef054fceb3ee9ed95fbed8164d52cf5", "96153c0cbe97ca050ce9041f59af46ff241bd67159797a2650521f02fc9f9b70", "961cb6df26e690006e909a03ffcc58ff7bcb40014724bfa600f6899a27e6bfc2",
  "963e53093a0e2e7dd32da3146f910c543f29504f916c0b9523b93225c58e494e", "96b8b96bb29633c1016bec0cdf2a23a82be416964ba5dd4cd36d38cce35b6360", "96c64ebcd48b9514589569d71adf0ca1ffbbb5896011d6865fc587d265d90653", "96f3c3ad81916d91faed0fa98fed769e255327a033c6c5476fe488e6660f052e",
  "974eccb453e4f3f688b6097cdd932e3bf1c35a72f0186993aa386500554b43a0", "9756b6d9e0192b59f5a9d1018ed3d44f44f4fe5cf700fefa1cbea9880986669e", "97b8f58db481633cd945180ee1b1c95a2cf4073b9a5afe9a5bd689f4c5b4d795", "97ca81bb4f24947abeb7bb08f24323aef60262561c60e85fcfea962e94785a35",
  "97e9fa6d34a1941060a94cb2677d74ef7ad04b96581c82f532c8d78d24915b78", "9905a0846c204423bfc55599d8ea94940e505b3256ba244b73b3d690d656d2bc", "994aeaf6e57d47f279e55c6d4a6f44970cb890d0064f008cb705579fba83ce10", "99f86be3e30992278d87cff4f449f9759068eae5913ef6e5ae8a17ac18e387a9",
  "9b4cbd5c65e5e48fd9b54cc26a4bed346ecfb0135e22a8dfd73c68ff48076daf", "9b62aa4f56e9dbe7abeaade5c27cb35f4c7ba2eb470ae132f31c4882e08669a2", "9bd7d6f73a365c7749258a371757349c8fe9b8c9c0c752a304cfbebbfa4909d1", "9c905de63bbc550466fa441669c886c91d61853ee9e51ce07454b23077413b73",
  "9ca2402aa2b3ca6f53781bf2c215ad8b52dcba44b3bcf62362a5404a3a086795", "9cfc5cbb8b921dff076932b757dc206e0949a0a7341d11d8040bfce18fc55be4", "9e4757afa608f1013d2433e6c6804a8fab7a9cc59e7c54b6603beaeaa59e3b82", "a01991fff92c5d55674be0073d4f8672204884bd51a8a96a831373105059eacd",
  "a0a294f77f9c08981b60dcf941d00e209c0ebc875f2421d7da8baa2635ce11c0", "a0f90eb57718d37af016a8d7e219b40a3a94acf5bce7906361d4bc9cd969b9be", "a1bb2a9bd0fd93a112c39e44aaa0692ed1f5bc04d363b7412ca8a955cdfbc802", "a1efea07c49a3a97bbe5a226559ebe5845e3746bcabf7339a8a225fe35ffbace",
  "a28c96c8675592096b90e4d8dd8eb694d8571f7f6195d4f2c8f035bbb89ce042", "a2d4b43c32a544d60419759ae49fb627d7ff067f3ee3777aa7778f5953370c5e", "a4dc7e1026af78f56205bb8d6c4a5d4e0575a79c233c225a7eb0d24e40be76f3", "a648ecf4d8978c39116aa962554a9430a1e298c7fb58776250fce311c7cc99ef",
  "a673c0ff128564397939218afa84a6a34b97df179708c519f621a0f74abe97c8", "a7589ff0942d879089ab134ddace6ded2d7c8b11f7ab09096299de5491b68fa4", "a97edd5bbf1645f00ddf711969b0e48c68bf517d8124478113b74bb791fad4e8", "aa1478a67229dbca614d7125b7042a64a9296632df6f36f50df2430d5593b0b8",
  "aba043d4a8513ce39894877f809040801a9b12113579e3c46cbbc8d259801db0", "abcb12986830444d7702f37fee56de662032bc424978e393c00362e4a992e352", "abf5ac7c4983de98a9175af9e11a4a55d7731fe73723efe1f1f72b94ebb0b7ad", "addbfc3a41b31a038962598f555eca24d76422f1254b51c44c7e7f506a865af1",
  "aead4d066ecab7ba59d13b909c88595ea7b4ed3c664f63cef59224455062c09e", "b03c50fbff651a032a6f92e096f9fb259068829346f46b74bb14e59b80be8d36", "b19bb6e04eb01d0362172019edb4b88f9bf9601d4a40eb5ea215c4c0bfaba303", "b1c4deeac2c4b9fb92121a37840b699b7908cf8549e7fef162228e7b016283a4",
  "b1ddbb27d64b56bed7bc1c98f4607b1e0c93b575c6d20746fadae97ccc543871", "b35d09b137e767f679ba5b604173eddfeebf5b8837d60c4b4900ab7d0cf137f5", "b40b67b3fb95656f5d08fe05816794434040d0bb6ef08d8815f1cc22bb7cf3f1", "b6135ef3798da73195accd8be91b43ea60969945de653bc43a23e88d595bfd09",
  "b63c72eff9aa80f3082103330ac895d0c20ff99177ed92ba788f3f607a174f46", "b8df367fe407cffd4439ee1d25a7ec93e00f01adedd8cf331060a9c8c6084730", "bc373970c18a1d42e29b65a041f4ed74986412120bf3babbfa0859713fedba9b", "bf93c61b3cba500c77c7a380c51db204e23a867e7705a656c244838726d276b9",
  "c00171cba03a171e24032465f9ef66c5ad7f16eb279f96ac48361ed04c370994", "c1f7c9abcec4282aa47fa1269ae42c3f9868a3e810f39763f0a164b1ee266048", "c282e7930517de1aebd5cbf6ab584d1279aa9ebe117f1deb5dc82a85890a9645", "c28be540dcc3858e1424e166fd297ada33e471fedaa7028d1db94eb0c1bf22cb",
  "c3ac18a7098f446b2a27cd53198d6eccec4f80d5037d4e6e7ff1e9c7ee657b52", "c3bcd418f83c8bae6443772d70e68f642513450a304ba06acb9624bf5fe17ed1", "c52118f97142ea7b0934469f36192c47b3067c7576487e536f26278d65e9a932", "c5dc333510231db73fe9b4543c607322226f2888191e74ca08ae9356c93c373e",
  "c7872a299e70384f4eff59b73508df624ec63c162e88b2e3f628fba2a86dc9b0", "c83554a9ae7829488c4c8fcaf6e7b03438cc6d0d49dde7205d20df90e8dc265f", "ca5fe4112f001e658a3fdac03aa3f713da9598881772bf16461743dbba6564fc", "ca8af4594ada28249ecea120312fb8843a8b81c0bd604e1b53af2bb27d204c83",
  "ca991aff39de4ae6514ab0442ebf76833327db611e78aca35609163c4767175c", "cb93511da43c6eaf598a320cb96fecd36f92aee69b38c3cfa25cfa3fd1ace589", "cc26a69f0a9d3e9d4b29920a2fdb8dae8bb9e339a056cd2eb66eed3ecb5e3e1f", "cd6e52de1d3e06991ec724f83ca4ac7f2c64101be736580fd6dd406f76356395",
  "cdf8090f86baa30e059b841a9344fe7e4a9da89a1aa448c30c7ee0f59a19ba8a", "d06aba0850cb42303830effa7ece9468124a35d91f898188f0ed1612e43edc52", "d3077970baf0a512241e3eb04e3535c47523608b980013a00991b65851ad64a8", "d387c81b6c5ce948b3f165e6f54e507e2daa2de3c7d1eb821e4c823ddb102e16",
  "d5e6bbdc7eb8852aef4b87618e1c515458d29280a341f7196657cf2413ece761", "d680580d3da7c3d18c0f764071a4e33933e202b5b52f6457870cc82c99d315e6", "d6efbf30a91a333fb1389256392b19214ed694e2ad3c5f20d34341d22d11da4b", "d719ae12794f7fec7d12b50828a28d1970aff365e2b8a65a09360b6a1e7176c2",
  "d8743d2ba6043db119485dcf1e6e6c1d7936d568b95d53b790ca3e10c9f61cd3", "d9241fe0748757e4f5023101530bc3ac159d600024847392ec266e0049c63e99", "dc144a3a3b493a2a27ea9121c2286abbdb384f21ccf73fabc5e2d1cb3b928db0", "dd6232f260355981363cce3c1a4658f56883b693427e05edf0b001c77173a049",
  "de55b36a645094408d183cfb8989cfcc9faff3f43fa68cb93177fa0ca6c3ed2f", "e194261ea9c75fee63db47222ae4f1d4db52e193403fbcd2415aef6370f9d7f1", "e3689a620afd8966d0a2029c7b5f4821618be2d6d740728968a51dacde05a41b", "e5888235714cde104596f42666625fd5eedc45f2cbb2309244ef848063d064bf",
  "e6b43ffe7173360ff710539239f224875abcf63b9fb29a796c6bd121d0c5797c", "e6ebf0cf438c35ffc911220e108ffd3d8a979722575b1c166089739ae1704d6b", "e72aa61f38aac625deb5142e91bc0cd42e5310a65c1f07ae2a740c548a6e7314", "e7ba569ce859cfc68bed9fcc7bf97abde521071dd62103b9c4ec9a36079863df",
  "ea604e5e0019cc229e856c31a6b684b71a6b3e1d9b0782c5138c23f829633172", "eb7b73814c9673ba4e50adef7a6472c34e830bc69f1e04c86e65cc2b30b0bc5f", "ec057e0aef6cff35d7927fc8b509e60ca866ffa432a2e596913ea459e615a1c8", "ed63ed3e575cb09b5676f246dcd4c99c88b9118d0234b67ee5bd25f001187657",
  "ef4a3595f21bbb47c7741592f873d8668e622f223f02fb1b01830b34aa5bdc93", "f28c8189319757361213cf448260556c31c4509a2e563051930239879f269a15", "f2f72cbbb94b7a1d5389e45c35dd43e79302b39727c37e76076eba7c8161a113", "f322ac2b56372db63657577b2f296608f3128aead1f8f036add1de4f269ff267",
  "f3717a80abbc8ac4dd8c9c3acce482935c90f47621500c8190b58cfbb820c715", "f41fddd098b82627f07430d870f3973d0b89d214af6ae2988e9dd226690f1681", "f7763736d6b5f4afba967fe22999839ebe50689cdf048b079f57d998cd082867", "f7c87a613ef7bd43a962ed3f2c1193165f2ebe20462b3aeecb34d878c08b3c9a",
  "f7de8e9381c1f30e6393bc727f4365d88ddf43a8e5137ae946cf81f3bbe3d997", "f8f837813ab5da6289eb843b8cc9f5206ec316c059f3f560d5a0f3780a64f320", "f92517e10797ab7a5bbce8979c72ce49011de51ba73869b2d5c668d26099f7ec", "f9678b05f8b7fe3e5549d3b3aefeea899fb5cd65826f494e7b568fa2fab7d263",
  "fbeceaacb3d6591198d44f5d6bf2223ceeef9784fe9626594523f8e37fc1a62a", "fcc357984fbf31e9ccd275885c12898c6205a13e859fb243add5bbc9c3f7935a", "fd8f91f3ff2b6b352deddceac488039529b358c906c3cf4304a1114f4d427eaf", "fde7b48284434a41d221b2a3fd48255c0e6808c13ae77312ddbd356850cacc94",
  "ff468b7739b7a18f8175d04031cae9a38b045ba612451cdda3ee0819244853de", "ff72ecd642f957c18b6ff131b35d154d8d8b1b1fdd61c2b7dbe97a1841d9e419",
];

function ehTextoNaoVazio(valor) {
  return typeof valor === "string" && valor.trim() !== "";
}

function ehInteiroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0;
}

/** Converte um rótulo oficial (eixo do conhecimento ou eixo cognitivo) num segmento de idInterno
 * estável — minúsculo, sem acento, sem espaço. Usado só para compor um identificador técnico legível;
 * o rótulo oficial completo (com acentos, maiúsculas, barras) é sempre preservado em campo próprio. */
function slug(valor) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Tupla can\u00f4nica de uma habilidade J\u00c1 ACHATADA (componente, etapa, quadro, p\u00e1gina, eixo do
 * conhecimento, eixo cognitivo, ordem editorial, c\u00f3digo oficial e texto integral), serializada de
 * forma determin\u00edstica e resumida em SHA-256. Usada por `HASHES_APROVADOS` (ver abaixo) para
 * detectar QUALQUER altera\u00e7\u00e3o num destes campos \u2014 inclusive uma troca sim\u00e9trica de eixo entre duas
 * habilidades que preservaria as contagens por eixo/eixo cognitivo (ver coment\u00e1rio de
 * `HASHES_APROVADOS`). Mudar a ORDEM dos campos aqui invalida todos os hashes j\u00e1 registrados \u2014
 * nunca reordenar sem regenerar `HASHES_APROVADOS` a partir de um cat\u00e1logo j\u00e1 aprovado.
 */
export function canonicalizarHabilidade(h) {
  const tupla = [h.componente, h.etapa, h.quadro, h.paginaRealPdf, h.eixoConhecimento, h.eixoCognitivo, h.ordemEditorial, h.codigoOficial, h.textoHabilidade];
  return createHash("sha256").update(JSON.stringify(tupla)).digest("hex");
}

export function validarFonte(fonte, chave, contexto) {
  if (!fonte || typeof fonte !== "object") {
    throw new MatrizBnccGeracaoError(`${contexto}: metadado de fonte ausente`);
  }
  for (const campo of ["id", "titulo", "orgao", "componente", "dataConsulta", "situacaoAplicacao"]) {
    if (!ehTextoNaoVazio(fonte[campo])) {
      throw new MatrizBnccGeracaoError(`${contexto}: campo "${campo}" precisa ser texto não vazio, recebeu ${JSON.stringify(fonte[campo])}`);
    }
  }
  if (fonte.componente !== chave) {
    throw new MatrizBnccGeracaoError(`${contexto}: campo "componente" (${JSON.stringify(fonte.componente)}) precisa ser igual à chave da fonte ("${chave}")`);
  }
  if (!ehInteiroPositivo(fonte.anoPublicacao) || fonte.anoPublicacao < 2000 || fonte.anoPublicacao > 2100) {
    throw new MatrizBnccGeracaoError(`${contexto}: anoPublicacao precisa ser um ano plausível, recebeu ${JSON.stringify(fonte.anoPublicacao)}`);
  }
  if (typeof fonte.hashSha256 !== "string" || !HASH_HEX_64.test(fonte.hashSha256)) {
    throw new MatrizBnccGeracaoError(`${contexto}: hashSha256 precisa ter exatamente 64 caracteres hexadecimais, recebeu ${JSON.stringify(fonte.hashSha256)} (${typeof fonte.hashSha256 === "string" ? fonte.hashSha256.length : "não é string"} caracteres)`);
  }
  if (!ehInteiroPositivo(fonte.tamanhoBytes)) {
    throw new MatrizBnccGeracaoError(`${contexto}: tamanhoBytes precisa ser um inteiro positivo, recebeu ${JSON.stringify(fonte.tamanhoBytes)}`);
  }
  if (!ehInteiroPositivo(fonte.totalPaginasPdf)) {
    throw new MatrizBnccGeracaoError(`${contexto}: totalPaginasPdf precisa ser um inteiro positivo, recebeu ${JSON.stringify(fonte.totalPaginasPdf)}`);
  }
  if (!ehTextoNaoVazio(fonte.url)) {
    throw new MatrizBnccGeracaoError(`${contexto}: campo "url" precisa ser texto não vazio`);
  }
  let url;
  try {
    url = new URL(fonte.url);
  } catch {
    throw new MatrizBnccGeracaoError(`${contexto}: url inválida: ${JSON.stringify(fonte.url)}`);
  }
  if (url.protocol !== "https:") {
    throw new MatrizBnccGeracaoError(`${contexto}: url precisa ser HTTPS, recebeu "${fonte.url}"`);
  }
  const dominioOficial = url.hostname === DOMINIO_OFICIAL_INEP || url.hostname.endsWith(`.${DOMINIO_OFICIAL_INEP}`);
  if (!dominioOficial) {
    throw new MatrizBnccGeracaoError(`${contexto}: url precisa pertencer ao domínio oficial do Inep (*.${DOMINIO_OFICIAL_INEP}), recebeu host "${url.hostname}"`);
  }
  if (!Array.isArray(fonte.etapasCobertas) || fonte.etapasCobertas.length === 0) {
    throw new MatrizBnccGeracaoError(`${contexto}: etapasCobertas precisa ser um array não vazio`);
  }
  for (const etapa of fonte.etapasCobertas) {
    if (!ETAPAS_VALIDAS.has(etapa)) {
      throw new MatrizBnccGeracaoError(`${contexto}: etapasCobertas contém etapa desconhecida: ${JSON.stringify(etapa)}`);
    }
  }
  if (fonte.distintaDaMatrizTradicional !== true) {
    throw new MatrizBnccGeracaoError(`${contexto}: distintaDaMatrizTradicional precisa ser exatamente true — este catálogo nunca pode ser confundido com a matriz tradicional`);
  }
  if (fonte.notaDocumental !== undefined && !ehTextoNaoVazio(fonte.notaDocumental)) {
    throw new MatrizBnccGeracaoError(`${contexto}: notaDocumental, quando presente, precisa ser texto não vazio`);
  }
}

export function validarTexto(texto, contexto) {
  if (!ehTextoNaoVazio(texto)) {
    throw new MatrizBnccGeracaoError(`${contexto}: texto da habilidade vazio ou ausente`);
  }
  if (texto.includes("\uFFFD")) {
    throw new MatrizBnccGeracaoError(`${contexto}: texto contém caractere de substituição (U+FFFD) — indica corrupção de extração não corrigida por leitura visual`);
  }
  if (texto.includes("...") || texto.includes("…")) {
    throw new MatrizBnccGeracaoError(`${contexto}: texto contém reticências (possível corte editorial ou truncamento) — leia visualmente e complete antes de aceitar`);
  }
  if (/^\s|\s$/.test(texto) || /\s{2,}/.test(texto)) {
    throw new MatrizBnccGeracaoError(`${contexto}: texto tem espaçamento não normalizado (espaço nas bordas ou espaços duplos) — normalize só o espaçamento, nunca o conteúdo`);
  }
  if (!/[.?!]"?$/.test(texto)) {
    throw new MatrizBnccGeracaoError(`${contexto}: texto não termina em pontuação (. ! ou ?) — possível truncamento: ${JSON.stringify(texto)}`);
  }
  if (/\[.*\]|<[a-z]/i.test(texto)) {
    throw new MatrizBnccGeracaoError(`${contexto}: texto contém colchetes de placeholder ou marcação HTML, nunca permitido: ${JSON.stringify(texto)}`);
  }
}

export function validarHabilidadeLinguagens(h, etapa, fontePaginas, contexto) {
  if (h.codigoOficial !== null) {
    throw new MatrizBnccGeracaoError(`${contexto}: Linguagens nunca tem código oficial — esperado null, recebeu ${JSON.stringify(h.codigoOficial)}`);
  }
  const eixosValidos = EIXOS_CONHECIMENTO_LINGUAGENS_POR_ETAPA[etapa];
  if (!eixosValidos || !eixosValidos.has(h.eixoConhecimento)) {
    throw new MatrizBnccGeracaoError(`${contexto}: eixo do conhecimento desconhecido para Linguagens/${etapa}: ${JSON.stringify(h.eixoConhecimento)}`);
  }
  if (etapa === "2anoEF") {
    if (h.eixoCognitivo !== null) {
      throw new MatrizBnccGeracaoError(`${contexto}: Linguagens 2º ano não usa eixo cognitivo — esperado null, recebeu ${JSON.stringify(h.eixoCognitivo)}`);
    }
  } else if (!EIXOS_COGNITIVOS_LINGUAGENS.has(h.eixoCognitivo)) {
    throw new MatrizBnccGeracaoError(`${contexto}: eixo cognitivo desconhecido para Linguagens: ${JSON.stringify(h.eixoCognitivo)}`);
  }
  if (!ehInteiroPositivo(h.ordemEditorial)) {
    throw new MatrizBnccGeracaoError(`${contexto}: ordemEditorial precisa ser inteiro positivo, recebeu ${JSON.stringify(h.ordemEditorial)}`);
  }
  if (!ehInteiroPositivo(h.paginaRealPdf) || h.paginaRealPdf > fontePaginas) {
    throw new MatrizBnccGeracaoError(`${contexto}: paginaRealPdf inválida ou além do total de páginas do PDF (${fontePaginas}): ${JSON.stringify(h.paginaRealPdf)}`);
  }
  validarTexto(h.textoHabilidade, contexto);
}

export function validarHabilidadeMatematica(h, etapa, fontePaginas, contexto) {
  if (typeof h.codigoOficial !== "string" || !CODIGO_MATEMATICA.test(h.codigoOficial)) {
    throw new MatrizBnccGeracaoError(`${contexto}: código oficial ausente ou fora do padrão da matriz BNCC de Matemática: ${JSON.stringify(h.codigoOficial)}`);
  }
  if (CODIGO_MATRIZ_TRADICIONAL.test(h.codigoOficial)) {
    throw new MatrizBnccGeracaoError(`${contexto}: código "${h.codigoOficial}" colide com o padrão da matriz TRADICIONAL (D<n>) — nunca misturar as duas estruturas de código`);
  }
  if (!EIXOS_CONHECIMENTO_MATEMATICA.has(h.eixoConhecimento)) {
    throw new MatrizBnccGeracaoError(`${contexto}: eixo do conhecimento desconhecido para Matemática: ${JSON.stringify(h.eixoConhecimento)}`);
  }
  if (!EIXOS_COGNITIVOS_MATEMATICA.has(h.eixoCognitivo)) {
    throw new MatrizBnccGeracaoError(`${contexto}: eixo cognitivo desconhecido para Matemática: ${JSON.stringify(h.eixoCognitivo)}`);
  }
  if (!ehInteiroPositivo(h.ordemEditorial)) {
    throw new MatrizBnccGeracaoError(`${contexto}: ordemEditorial precisa ser inteiro positivo, recebeu ${JSON.stringify(h.ordemEditorial)}`);
  }
  if (!ehInteiroPositivo(h.paginaRealPdf) || h.paginaRealPdf > fontePaginas) {
    throw new MatrizBnccGeracaoError(`${contexto}: paginaRealPdf inválida ou além do total de páginas do PDF (${fontePaginas}): ${JSON.stringify(h.paginaRealPdf)}`);
  }

  // Validação SEMÂNTICA da estrutura do código — não basta o código bater com o padrão sintático
  // geral (CODIGO_MATEMATICA); cada segmento precisa corresponder exatamente aos campos declarados
  // desta habilidade. Isso rejeita, por exemplo, "9N1.1" arquivado sob eixoConhecimento "Geometria"
  // (a letra do código, N, não bate com G) mesmo que "9N1.1" sozinho pareça um código válido.
  const partes = /^(\d)([A-Z]{1,2})(\d)\.(\d{1,2})$/.exec(h.codigoOficial);
  const [, etapaDigito, eixoLetra, cognitivoDigito, sufixoStr] = partes;
  const etapaDigitoEsperado = ETAPA_DIGITO_MATEMATICA[etapa];
  if (etapaDigito !== etapaDigitoEsperado) {
    throw new MatrizBnccGeracaoError(
      `${contexto}: código "${h.codigoOficial}" começa com o dígito de etapa "${etapaDigito}", mas esta habilidade pertence à etapa "${etapa}" (dígito esperado "${etapaDigitoEsperado}") — código de outra etapa arquivado aqui`,
    );
  }
  const eixoLetraEsperada = EIXO_LETRA_MATEMATICA[h.eixoConhecimento];
  if (eixoLetra !== eixoLetraEsperada) {
    throw new MatrizBnccGeracaoError(
      `${contexto}: código "${h.codigoOficial}" tem a letra "${eixoLetra}", mas eixoConhecimento é "${h.eixoConhecimento}" (letra esperada "${eixoLetraEsperada}") — habilidade arquivada no eixo errado`,
    );
  }
  const cognitivoDigitoEsperado = COGNITIVO_DIGITO_MATEMATICA[h.eixoCognitivo];
  if (cognitivoDigito !== cognitivoDigitoEsperado) {
    throw new MatrizBnccGeracaoError(
      `${contexto}: código "${h.codigoOficial}" tem o dígito cognitivo "${cognitivoDigito}", mas eixoCognitivo é "${h.eixoCognitivo}" (dígito esperado "${cognitivoDigitoEsperado}") — habilidade arquivada no eixo cognitivo errado`,
    );
  }
  // O sufixo numérico do código (".N") precisa ser exatamente a ordemEditorial declarada — os dois
  // campos precisam concordar, nunca divergir silenciosamente.
  const sufixo = Number(sufixoStr);
  if (sufixo !== h.ordemEditorial) {
    throw new MatrizBnccGeracaoError(`${contexto}: sufixo do código "${h.codigoOficial}" (${sufixo}) diverge de ordemEditorial (${h.ordemEditorial})`);
  }
  validarTexto(h.textoHabilidade, contexto);
}

export function validarMatriz(matriz, fontes) {
  const contexto = `matriz ${matriz.componente ?? "?"}/${matriz.etapa ?? "?"}`;
  if (!COMPONENTES_VALIDOS.has(matriz.componente)) throw new MatrizBnccGeracaoError(`${contexto}: componente desconhecido`);
  if (!ETAPAS_VALIDAS.has(matriz.etapa)) throw new MatrizBnccGeracaoError(`${contexto}: etapa desconhecida`);
  const fonte = fontes[matriz.componente];
  if (!fonte.etapasCobertas.includes(matriz.etapa)) {
    throw new MatrizBnccGeracaoError(`${contexto}: etapa incompatível — a fonte "${matriz.componente}" não declara cobertura desta etapa`);
  }
  for (const campo of ["quadro", "tituloOficial"]) {
    if (!ehTextoNaoVazio(matriz[campo])) {
      throw new MatrizBnccGeracaoError(`${contexto}: campo "${campo}" precisa ser texto não vazio`);
    }
  }
  if (!Array.isArray(matriz.habilidades) || matriz.habilidades.length === 0) {
    throw new MatrizBnccGeracaoError(`${contexto}: sem habilidades`);
  }

  for (const h of matriz.habilidades) {
    if (matriz.componente === "linguagens") {
      validarHabilidadeLinguagens(h, matriz.etapa, fonte.totalPaginasPdf, contexto);
    } else {
      validarHabilidadeMatematica(h, matriz.etapa, fonte.totalPaginasPdf, contexto);
    }
  }

  // Contagem exata por (componente, etapa) — literal, nunca derivada do próprio arquivo.
  const chaveEtapa = `${matriz.componente}/${matriz.etapa}`;
  const esperadoEtapa = CONTAGEM_ESPERADA_POR_ETAPA[chaveEtapa];
  if (esperadoEtapa === undefined) {
    throw new MatrizBnccGeracaoError(`${contexto}: nenhuma contagem esperada registrada para "${chaveEtapa}" — atualize CONTAGEM_ESPERADA_POR_ETAPA deliberadamente antes de aceitar`);
  }
  if (matriz.habilidades.length !== esperadoEtapa) {
    throw new MatrizBnccGeracaoError(`${contexto}: esperado exatamente ${esperadoEtapa} habilidades, encontrado ${matriz.habilidades.length}`);
  }

  // Contagem exata por eixo do conhecimento dentro da etapa — detecta habilidade arquivada no eixo
  // errado mesmo quando o total da etapa bate (ver comentário de CONTAGEM_ESPERADA_POR_EIXO).
  const porEixo = {};
  for (const h of matriz.habilidades) porEixo[h.eixoConhecimento] = (porEixo[h.eixoConhecimento] ?? 0) + 1;
  const esperadoPorEixo = CONTAGEM_ESPERADA_POR_EIXO[chaveEtapa];
  const eixosEsperados = Object.keys(esperadoPorEixo).sort();
  const eixosReais = Object.keys(porEixo).sort();
  if (eixosEsperados.length !== eixosReais.length || !eixosEsperados.every((e, i) => e === eixosReais[i])) {
    throw new MatrizBnccGeracaoError(`${contexto}: conjunto de eixos do conhecimento inesperado — esperado ${JSON.stringify(eixosEsperados)}, encontrado ${JSON.stringify(eixosReais)}`);
  }
  for (const [eixo, esperado] of Object.entries(esperadoPorEixo)) {
    if (porEixo[eixo] !== esperado) {
      throw new MatrizBnccGeracaoError(`${contexto}: eixo "${eixo}" deveria ter exatamente ${esperado} habilidades, encontrado ${porEixo[eixo] ?? 0} — possível habilidade arquivada no eixo errado`);
    }
  }

  // Contagem exata por eixo cognitivo dentro da etapa (quando aplicável).
  const esperadoPorCognitivo = CONTAGEM_ESPERADA_POR_COGNITIVO[chaveEtapa];
  if (esperadoPorCognitivo) {
    const porCognitivo = {};
    for (const h of matriz.habilidades) porCognitivo[h.eixoCognitivo] = (porCognitivo[h.eixoCognitivo] ?? 0) + 1;
    for (const [cog, esperado] of Object.entries(esperadoPorCognitivo)) {
      if (porCognitivo[cog] !== esperado) {
        throw new MatrizBnccGeracaoError(`${contexto}: eixo cognitivo "${cog}" deveria ter exatamente ${esperado} habilidades, encontrado ${porCognitivo[cog] ?? 0}`);
      }
    }
  }

  // Nenhuma ordemEditorial duplicada dentro da mesma célula (eixo do conhecimento × eixo cognitivo).
  const porCelula = {};
  for (const h of matriz.habilidades) {
    const chaveCelula = `${h.eixoConhecimento}\u0000${h.eixoCognitivo}`;
    (porCelula[chaveCelula] ??= []).push(h.ordemEditorial);
  }
  for (const [chaveCelula, ordens] of Object.entries(porCelula)) {
    if (new Set(ordens).size !== ordens.length) {
      throw new MatrizBnccGeracaoError(`${contexto}: ordemEditorial duplicada na célula "${chaveCelula}" — ordens: ${JSON.stringify(ordens)}`);
    }
    const ordenadas = [...ordens].sort((a, b) => a - b);
    for (let i = 0; i < ordenadas.length; i += 1) {
      if (ordenadas[i] !== i + 1) {
        throw new MatrizBnccGeracaoError(`${contexto}: ordemEditorial não é densa a partir de 1 na célula "${chaveCelula}" — esperado ${i + 1}, encontrado ${ordenadas[i]} (ordens: ${JSON.stringify(ordenadas)})`);
      }
    }
  }

  // Nenhum texto duplicado DENTRO da mesma etapa — o mesmo texto em etapas diferentes é normal
  // (a mesma habilidade pode ser reavaliada em outro ano), mas duas habilidades distintas na MESMA
  // etapa com texto idêntico indicaria erro de transcrição, nunca aceito silenciosamente.
  const textosVistos = new Map();
  for (const h of matriz.habilidades) {
    textosVistos.set(h.textoHabilidade, (textosVistos.get(h.textoHabilidade) ?? 0) + 1);
  }
  const duplicados = [...textosVistos.entries()].filter(([, n]) => n > 1);
  if (duplicados.length > 0) {
    throw new MatrizBnccGeracaoError(`${contexto}: texto de habilidade duplicado dentro da mesma etapa, sem justificativa documental: ${JSON.stringify(duplicados.map(([t]) => t))}`);
  }
}

/** SHA-256 (hex) dos bytes reais de um arquivo local — nunca busca o PDF pela rede. */
export function calcularHashSha256(caminhoArquivo) {
  const bytes = readFileSync(caminhoArquivo);
  return createHash("sha256").update(bytes).digest("hex");
}

/** Confere hashSha256 contra os bytes reais de uma cópia local do PDF — nunca chamada
 * automaticamente por `gerar()` (os PDFs oficiais vivem fora do repositório). */
export function verificarHashPdfLocal({ caminhoArquivo, hashEsperado }) {
  const hashCalculado = calcularHashSha256(caminhoArquivo);
  if (hashCalculado !== hashEsperado) {
    throw new MatrizBnccGeracaoError(
      `Hash SHA-256 do arquivo local (${caminhoArquivo}) não confere com o hash registrado — esperado ${hashEsperado}, calculado ${hashCalculado}. ` +
        "O arquivo pode ter sido substituído, corrompido, ou o Inep pode ter republicado o PDF — reconfira manualmente antes de atualizar hashSha256.",
    );
  }
}

export function gerar({ fontePath = FONTE_PATH, saidaPath = SAIDA_PATH, escrever = true } = {}) {
  const bruto = readFileSync(fontePath, "utf-8");
  const fonteJson = JSON.parse(bruto);

  const { fontes, matrizes, notasEditoriais } = fonteJson;
  if (!fontes || typeof fontes !== "object") {
    throw new MatrizBnccGeracaoError('Nenhum metadado de fonte encontrado no arquivo-fonte (campo "fontes")');
  }
  for (const componente of COMPONENTES_VALIDOS) {
    if (!fontes[componente]) {
      throw new MatrizBnccGeracaoError(`Metadado de fonte ausente para o componente "${componente}"`);
    }
    validarFonte(fontes[componente], componente, `fontes.${componente}`);
  }
  if (!Array.isArray(matrizes) || matrizes.length === 0) {
    throw new MatrizBnccGeracaoError("Nenhuma matriz encontrada no arquivo-fonte");
  }
  for (const matriz of matrizes) validarMatriz(matriz, fontes);

  // Escopo exato: as três etapas × os dois componentes, nem mais nem menos.
  const chaves = matrizes.map((m) => `${m.componente}/${m.etapa}`).sort();
  const esperado = Object.keys(CONTAGEM_ESPERADA_POR_ETAPA).sort();
  if (chaves.length !== esperado.length || !chaves.every((c, i) => c === esperado[i])) {
    throw new MatrizBnccGeracaoError(`Escopo do catálogo inesperado — esperado exatamente ${JSON.stringify(esperado)}, encontrado ${JSON.stringify(chaves)}`);
  }

  // Notas editoriais do próprio PDF (ex.: a explicação de Álgebra/9º ano sobre uma habilidade
  // deliberadamente ausente) nunca podem ser contadas como habilidade — nem por acidente de texto
  // idêntico, nem por estarem na lista errada.
  if (notasEditoriais !== undefined) {
    if (!Array.isArray(notasEditoriais)) {
      throw new MatrizBnccGeracaoError('"notasEditoriais", quando presente, precisa ser um array');
    }
    const textosHabilidades = new Set(matrizes.flatMap((m) => m.habilidades.map((h) => h.textoHabilidade)));
    for (const nota of notasEditoriais) {
      if (!ehTextoNaoVazio(nota.texto)) {
        throw new MatrizBnccGeracaoError('notasEditoriais: cada nota precisa ter campo "texto" não vazio');
      }
      if (textosHabilidades.has(nota.texto)) {
        throw new MatrizBnccGeracaoError(`notasEditoriais: o texto da nota coincide com o texto de uma habilidade — uma nota editorial nunca pode ser contada como habilidade: ${JSON.stringify(nota.texto)}`);
      }
    }
  }

  // Achata as matrizes em uma lista única de habilidades, cada uma com idInterno estável e
  // auto-suficiente (componente/etapa/quadro/página embutidos — nunca é preciso voltar à matriz-pai
  // para saber de onde uma habilidade veio).
  const habilidades = [];
  const idsVistos = new Set();
  for (const matriz of matrizes) {
    for (const h of matriz.habilidades) {
      const idInterno = `${matriz.componente}.${matriz.etapa}.${slug(h.eixoConhecimento)}.${h.eixoCognitivo ? slug(h.eixoCognitivo) : "sem-eixo-cognitivo"}.${h.ordemEditorial}`;
      if (idsVistos.has(idInterno)) {
        throw new MatrizBnccGeracaoError(`idInterno duplicado (não deveria ser possível se as validações de célula passaram): ${idInterno}`);
      }
      idsVistos.add(idInterno);
      habilidades.push({
        idInterno,
        codigoOficial: h.codigoOficial,
        componente: matriz.componente,
        etapa: matriz.etapa,
        quadro: matriz.quadro,
        paginaRealPdf: h.paginaRealPdf,
        eixoConhecimento: h.eixoConhecimento,
        eixoCognitivo: h.eixoCognitivo,
        ordemEditorial: h.ordemEditorial,
        textoHabilidade: h.textoHabilidade,
        fonteRef: matriz.componente,
      });
    }
  }

  // Totais gerais — última linha de defesa, redundante com as somas por etapa acima (deliberado:
  // nenhuma validação sozinha deveria ser a única barreira contra um catálogo incorreto).
  const totalLinguagens = habilidades.filter((h) => h.componente === "linguagens").length;
  const totalMatematica = habilidades.filter((h) => h.componente === "matematica").length;
  if (totalLinguagens !== TOTAL_ESPERADO_LINGUAGENS) {
    throw new MatrizBnccGeracaoError(`Total de Linguagens deveria ser ${TOTAL_ESPERADO_LINGUAGENS}, encontrado ${totalLinguagens}`);
  }
  if (totalMatematica !== TOTAL_ESPERADO_MATEMATICA) {
    throw new MatrizBnccGeracaoError(`Total de Matemática deveria ser ${TOTAL_ESPERADO_MATEMATICA}, encontrado ${totalMatematica}`);
  }
  if (habilidades.length !== TOTAL_ESPERADO_GERAL) {
    throw new MatrizBnccGeracaoError(`Total geral deveria ser ${TOTAL_ESPERADO_GERAL}, encontrado ${habilidades.length}`);
  }

  // Códigos de Matemática: únicos, e cada cruzamento etapa+eixo+eixoCognitivo forma uma sequência
  // ".1, .2, .3..." densa a partir de 1 — sem lacuna nem repetição (mesmo raciocínio de
  // validarGrupo/validarMatriz em scripts/saeb-descritores/gerar.mjs, adaptado ao esquema de código
  // próprio desta matriz).
  const codigosMatematica = habilidades.filter((h) => h.componente === "matematica").map((h) => h.codigoOficial);
  if (new Set(codigosMatematica).size !== codigosMatematica.length) {
    throw new MatrizBnccGeracaoError(`Há código de Matemática duplicado — códigos: ${JSON.stringify(codigosMatematica)}`);
  }
  const gruposCodigo = {};
  for (const codigo of codigosMatematica) {
    const [prefixo, sufixo] = codigo.split(".");
    (gruposCodigo[prefixo] ??= []).push(Number(sufixo));
  }
  for (const [prefixo, sufixos] of Object.entries(gruposCodigo)) {
    const ordenados = [...sufixos].sort((a, b) => a - b);
    for (let i = 0; i < ordenados.length; i += 1) {
      if (ordenados[i] !== i + 1) {
        throw new MatrizBnccGeracaoError(`Sequência de código "${prefixo}.*" tem lacuna ou repetição — esperado .${i + 1}, encontrado .${ordenados[i]} (sufixos: ${JSON.stringify(ordenados)})`);
      }
    }
  }

  // Reconciliação independente adicional (soma por eixo do conhecimento e por eixo cognitivo de
  // Matemática, agregada nas três etapas) — terceira e quarta via da Rodada 9, replicadas aqui.
  const matematicaHabilidades = habilidades.filter((h) => h.componente === "matematica");
  const porEixoTotal = {};
  const porCognitivoTotal = {};
  for (const h of matematicaHabilidades) {
    porEixoTotal[h.eixoConhecimento] = (porEixoTotal[h.eixoConhecimento] ?? 0) + 1;
    porCognitivoTotal[h.eixoCognitivo] = (porCognitivoTotal[h.eixoCognitivo] ?? 0) + 1;
  }
  for (const [eixo, esperado] of Object.entries(CONTAGEM_ESPERADA_POR_EIXO_MATEMATICA_TOTAL)) {
    if (porEixoTotal[eixo] !== esperado) {
      throw new MatrizBnccGeracaoError(`Reconciliação por eixo (Matemática, total): "${eixo}" deveria somar ${esperado}, encontrado ${porEixoTotal[eixo] ?? 0}`);
    }
  }
  for (const [cog, esperado] of Object.entries(CONTAGEM_ESPERADA_POR_COGNITIVO_MATEMATICA_TOTAL)) {
    if (porCognitivoTotal[cog] !== esperado) {
      throw new MatrizBnccGeracaoError(`Reconciliação por eixo cognitivo (Matemática, total): "${cog}" deveria somar ${esperado}, encontrado ${porCognitivoTotal[cog] ?? 0}`);
    }
  }

  // Conjunto EXATO de registros aprovados, por hash SHA-256 de tupla canônica — literal, calculado
  // uma única vez a partir do catálogo já revisado e congelado em HASHES_APROVADOS (nunca recalculado
  // a partir deste arquivo-fonte). Isto é o que de fato impede uma TROCA SIMÉTRICA entre duas
  // habilidades (ex.: os textos de "Leitura" e "Arte" trocados entre si, ou "9N1.1" e "9G1.1"
  // trocados de eixo): uma troca desse tipo preserva TODAS as contagens por etapa/eixo/eixo cognitivo
  // acima (são só reconciliações de CONTAGEM, não de IDENTIDADE), mas muda a tupla canônica de cada
  // um dos dois registros trocados — o hash resultante não aparece em HASHES_APROVADOS, e o hash
  // aprovado de cada posição original passa a faltar no conjunto produzido. A comparação abaixo é por
  // CONJUNTO (Set), não por posição/ordem, e falha citando quantos hashes esperados estão faltando e
  // quantos hashes não reconhecidos apareceram (nunca "provavelmente" — sempre um número exato).
  const hashesProduzidos = habilidades.map((h) => canonicalizarHabilidade(h));
  const setProduzido = new Set(hashesProduzidos);
  const setAprovado = new Set(HASHES_APROVADOS);
  if (hashesProduzidos.length !== new Set(hashesProduzidos).size) {
    throw new MatrizBnccGeracaoError("Duas habilidades diferentes produziram a mesma tupla canônica (hash duplicado) — não deveria ser possível com idInterno único; investigue antes de aceitar.");
  }
  const faltando = [...setAprovado].filter((hash) => !setProduzido.has(hash));
  const inesperados = [...setProduzido].filter((hash) => !setAprovado.has(hash));
  if (faltando.length > 0 || inesperados.length > 0) {
    throw new MatrizBnccGeracaoError(
      `O conjunto de ${HASHES_APROVADOS.length} registros aprovados (hash SHA-256 de tupla canônica: componente/etapa/quadro/página/eixo/eixoCognitivo/ordem/código/texto) não bate exatamente com o produzido — ` +
        `${faltando.length} hash(es) aprovado(s) não encontrado(s) no catálogo produzido, ${inesperados.length} hash(es) inesperado(s) presente(s). ` +
        "Isto detecta qualquer alteração num desses campos, inclusive uma troca simétrica entre duas habilidades que preserva os totais por eixo/eixo cognitivo. " +
        "Se a mudança for uma correção documental legítima (confirmada visualmente contra o PDF), atualize HASHES_APROVADOS deliberadamente — nunca ajuste este conjunto para simplesmente fazer a validação passar sem reconferir a fonte.",
    );
  }

  const catalogo = {
    schema: "saeb-matriz-bncc/1",
    catalogo: {
      componentes: ["linguagens", "matematica"],
      etapas: ["2anoEF", "5anoEF", "9anoEF"],
      distintoDaMatrizTradicional: true,
      totalHabilidades: habilidades.length,
      totalPorComponente: { linguagens: totalLinguagens, matematica: totalMatematica },
    },
    fontes,
    matrizes: matrizes.map((m) => ({ componente: m.componente, etapa: m.etapa, quadro: m.quadro, tituloOficial: m.tituloOficial })),
    habilidades,
    notasEditoriais: notasEditoriais ?? [],
  };

  const texto = serializar(catalogo);
  let escrito = false;
  if (escrever) {
    let atual;
    try {
      atual = readFileSync(saidaPath, "utf-8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (atual !== texto) {
      writeFileSync(saidaPath, texto, "utf-8");
      escrito = true;
    }
  }
  return { catalogo, texto, escrito };
}

/** Verifica que o catálogo já versionado em `saidaPath` é exatamente o que `gerar` produziria agora
 * — nunca escreve em `saidaPath`. */
export function verificar({ fontePath = FONTE_PATH, saidaPath = SAIDA_PATH } = {}) {
  const { texto: esperado } = gerar({ fontePath, saidaPath, escrever: false });
  let atual;
  try {
    atual = readFileSync(saidaPath, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new MatrizBnccGeracaoError(`Catálogo versionado não encontrado em ${saidaPath} — rode "npm run saeb:matriz-bncc:gerar" primeiro.`);
    }
    throw error;
  }
  if (atual !== esperado) {
    throw new MatrizBnccGeracaoError(
      `Catálogo versionado em ${saidaPath} diverge da fonte em ${fontePath} — rode "npm run saeb:matriz-bncc:gerar" para regenerá-lo. Nunca edite o catálogo gerado manualmente.`,
    );
  }
  return { texto: esperado };
}

// Execução direta: node scripts/saeb-matriz-bncc/gerar.mjs [--check]
const executadoDiretamente = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (executadoDiretamente) {
  const modoCheck = process.argv.includes("--check");
  try {
    if (modoCheck) {
      verificar();
      console.log(`Catálogo em dia com a fonte: ${SAIDA_PATH}`);
    } else {
      const { texto, escrito } = gerar();
      const acao = escrito ? "Catálogo gerado" : "Catálogo já em dia (nada escrito)";
      console.log(`${acao}: ${SAIDA_PATH} (${Buffer.byteLength(texto, "utf-8")} bytes)`);
    }
  } catch (error) {
    if (error instanceof MatrizBnccGeracaoError) {
      console.error(`${modoCheck ? "Verificação" : "Geração"} interrompida: ${error.message}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
