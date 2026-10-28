// Testes de MUTAÇÃO ponta a ponta do gerador da BNCC Computação (scripts/bncc-computacao/gerar.mjs).
//
// Cada teste parte de uma CÓPIA TEMPORÁRIA das quatro fontes reais (141 habilidades/objetivos já
// aprovadas), aplica UMA mutação que um erro de transcrição ou uma adulteração poderiam produzir e prova
// que `gerar()` — com toda a cadeia de validação (sintática, semântica, tabela canônica de códigos e
// conjunto literal de hashes aprovados) — rejeita o resultado. Nenhum teste escreve em data/bncc/:
// `fonteDir` e `saidaDir` apontam sempre para o diretório temporário.
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { BnccComputacaoGeracaoError, ESCOPOS, arquivoFonte, gerar } from "../scripts/bncc-computacao/gerar.mjs";

const DIR_FONTE_REAL = join(process.cwd(), "data", "bncc", "source");
let dir;
test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bncc-computacao-mutacao-"));
  for (const e of ESCOPOS) cpSync(join(DIR_FONTE_REAL, arquivoFonte(e)), join(dir, arquivoFonte(e)));
});
test.afterEach(() => rmSync(dir, { recursive: true, force: true }));

const ler = (escopo) => JSON.parse(readFileSync(join(dir, arquivoFonte(escopo)), "utf-8"));
const gravar = (escopo, f) => writeFileSync(join(dir, arquivoFonte(escopo)), JSON.stringify(f));
const reg = (f, codigo) => {
  const r = f.registros.find((x) => x.codigo === codigo);
  assert.ok(r, `${codigo} deveria existir na fonte real`);
  return r;
};
const tentar = () => gerar({ fonteDir: dir, saidaDir: dir, escrever: false });
function rejeita(padrao, mensagem) {
  assert.throws(tentar, (e) => e instanceof BnccComputacaoGeracaoError && padrao.test(e.message), mensagem);
}
function mutar(escopo, fn) {
  const f = ler(escopo);
  fn(f);
  gravar(escopo, f);
}

test("sanidade: a fonte íntegra gera sem erro e sem escrever nada", () => {
  const r = tentar();
  assert.equal(ESCOPOS.reduce((n, e) => n + r[e].catalogo.metadata.total_habilidades_e_objetivos, 0), 141);
  for (const e of ESCOPOS) assert.equal(existsSync(join(dir, `computacao-${e}.json`)), false);
});

test("troca simétrica de EIXO entre duas habilidades (contagens por eixo preservadas) é rejeitada", () => {
  mutar("anos-iniciais", (f) => {
    const a = reg(f, "EF01CO01"); // Pensamento Computacional
    const b = reg(f, "EF01CO04"); // Mundo Digital
    [a.eixo, b.eixo] = [b.eixo, a.eixo];
  });
  rejeita(/eixo ".*" incompatível com o eixo canônico/);
});

test("troca simétrica de eixo E de objeto entre duas habilidades é rejeitada (hash/tabela canônica)", () => {
  mutar("anos-iniciais", (f) => {
    const a = reg(f, "EF02CO01");
    const b = reg(f, "EF02CO03");
    [a.eixo, b.eixo] = [b.eixo, a.eixo];
    [a.objeto_conhecimento, b.objeto_conhecimento] = [b.objeto_conhecimento, a.objeto_conhecimento];
  });
  rejeita(/incompatível com o eixo canônico|diverge do canônico/);
});

test("troca de dois códigos entre anos diferentes (EF01CO01 ↔ EF02CO01) é rejeitada", () => {
  mutar("anos-iniciais", (f) => {
    const a = reg(f, "EF01CO01");
    const b = reg(f, "EF02CO01");
    [a.codigo, b.codigo] = [b.codigo, a.codigo];
  });
  rejeita(/incompatível com o código|diverge da tabela canônica|diverge do canônico|diverge/);
});

test("troca de textos entre dois anos (preservando todos os códigos, eixos e contagens) é rejeitada pelo hash", () => {
  mutar("anos-iniciais", (f) => {
    const a = reg(f, "EF01CO01");
    const b = reg(f, "EF02CO01");
    [a.texto, b.texto] = [b.texto, a.texto];
  });
  rejeita(/registros aprovados .* não bate/);
});

test("habilidade de uma etapa arquivada em outra etapa (EF01CO01 dentro da Educação Infantil) é rejeitada", () => {
  const ai = ler("anos-iniciais");
  const ei = ler("educacao-infantil");
  const movida = ai.registros.splice(0, 1)[0];
  ei.registros.push(movida);
  gravar("anos-iniciais", ai);
  gravar("educacao-infantil", ei);
  rejeita(/incompatível com o escopo|tipo ".*" incompatível/);
});

test("troca de duas habilidades entre etapas (EI03CO01 ↔ EF01CO01, contagens preservadas) é rejeitada", () => {
  const ai = ler("anos-iniciais");
  const ei = ler("educacao-infantil");
  const a = ei.registros.splice(0, 1)[0];
  const b = ai.registros.splice(0, 1)[0];
  ai.registros.push(a);
  ei.registros.push(b);
  gravar("anos-iniciais", ai);
  gravar("educacao-infantil", ei);
  rejeita(/incompatível|escopo/);
});

test("alterar UMA palavra do texto oficial é rejeitado", () => {
  mutar("anos-finais", (f) => {
    const r = reg(f, "EF07CO02");
    r.texto = r.texto.replace("Analisar programas", "Analisar programa");
  });
  rejeita(/registros aprovados .* não bate/);
});

test("alterar UMA palavra da explicação ou do exemplo é rejeitado", () => {
  mutar("anos-finais", (f) => {
    reg(f, "EF08CO03").explicacao = reg(f, "EF08CO03").explicacao.replace("Para isso", "Por isso");
  });
  rejeita(/registros aprovados .* não bate/);
});

test("código com prefixo de outra etapa (EF01CO01 → EM13CO01) é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    reg(f, "EF01CO01").codigo = "EM13CO01";
  });
  rejeita(/incompatível com a etapa\/segmento/);
});

test("código com formato inválido (EF05CO011, 3 dígitos) é rejeitado — a fonte usa o código corrigido EF05CO11", () => {
  mutar("anos-iniciais", (f) => {
    reg(f, "EF05CO11").codigo = "EF05CO011";
  });
  rejeita(/código com formato inválido/);
});

test("código duplicado é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    const a = reg(f, "EF01CO01");
    reg(f, "EF01CO02").codigo = a.codigo;
  });
  rejeita(/código duplicado|diverge|incompatível/);
});

test("remover um código (habilidade ausente) é rejeitado", () => {
  mutar("anos-finais", (f) => {
    f.registros = f.registros.filter((r) => r.codigo !== "EF08CO06");
  });
  rejeita(/esperados exatamente 54 registros/);
});

test("inventar um código intermediário (EF01CO08 clonando EF01CO07) é rejeitado, mesmo que outra habilidade seja removida para preservar o total", () => {
  mutar("anos-iniciais", (f) => {
    const clone = structuredClone(reg(f, "EF01CO07"));
    clone.codigo = "EF01CO08";
    f.registros = f.registros.filter((r) => r.codigo !== "EF05CO11");
    f.registros.push(clone);
  });
  rejeita(/não existe na tabela canônica/);
});

test("preencher a lacuna de uma sequência artificialmente (um 'EM13CO27') é rejeitado", () => {
  mutar("ensino-medio", (f) => {
    const clone = structuredClone(reg(f, "EM13CO26"));
    clone.codigo = "EM13CO27";
    f.registros.pop();
    f.registros.push(clone);
  });
  rejeita(/não existe na tabela canônica/);
});

test("trocar o objeto de conhecimento entre duas habilidades é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    const a = reg(f, "EF03CO04");
    const b = reg(f, "EF03CO06");
    [a.objeto_conhecimento, b.objeto_conhecimento] = [b.objeto_conhecimento, a.objeto_conhecimento];
  });
  rejeita(/diverge do canônico/);
});

test("trocar a competência específica entre duas habilidades do Ensino Médio é rejeitado", () => {
  mutar("ensino-medio", (f) => {
    const a = reg(f, "EM13CO01");
    const b = reg(f, "EM13CO12");
    [a.competencia_especifica, b.competencia_especifica] = [b.competencia_especifica, a.competencia_especifica];
  });
  rejeita(/competência específica .* diverge da tabela canônica/);
});

test("remover a competência específica de uma habilidade do Ensino Médio é rejeitado", () => {
  mutar("ensino-medio", (f) => {
    reg(f, "EM13CO10").competencia_especifica = null;
  });
  rejeita(/competência específica ausente/);
});

test("alterar a página dentro de um intervalo válido (preservando a coerência impressa/complemento) é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    const r = reg(f, "EF02CO03");
    r.pagina_fonte += 2;
    r.pagina_impressa += 2;
    r.pagina_fonte_complemento += 2;
    r.pagina_impressa_complemento += 2;
  });
  rejeita(/diverge da página canônica/);
});

test("trocar a página entre duas habilidades (todas as contagens preservadas) é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    const a = reg(f, "EF01CO01"); // p. 16
    const b = reg(f, "EF01CO06"); // p. 18
    for (const campo of ["pagina_fonte", "pagina_impressa", "pagina_fonte_complemento", "pagina_impressa_complemento", "quadro_fonte"]) [a[campo], b[campo]] = [b[campo], a[campo]];
  });
  rejeita(/diverge da página canônica/);
});

test("página inválida (0, negativa ou além do PDF) é rejeitada", () => {
  for (const valor of [0, -3, 76, 99]) {
    mutar("anos-iniciais", (f) => {
      reg(f, "EF01CO01").pagina_fonte = valor;
    });
    rejeita(/página inválida/, `página ${valor}`);
    cpSync(join(DIR_FONTE_REAL, arquivoFonte("anos-iniciais")), join(dir, arquivoFonte("anos-iniciais")));
  }
});

test("mover a explicação para o campo da habilidade (texto = explicação) é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    const r = reg(f, "EF01CO01");
    r.texto = r.explicacao;
  });
  rejeita(/começa como explicação ou exemplo|explicação tratada como habilidade|tamanho implausível|verbo no infinitivo/);
});

test("mover um exemplo para o campo da habilidade (texto = exemplo) é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    const r = reg(f, "EF01CO02");
    r.texto = r.exemplos[0];
  });
  rejeita(/começa como explicação ou exemplo|exemplo tratado|tamanho implausível|verbo no infinitivo/);
});

test("um exemplo idêntico ao texto da habilidade é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    const r = reg(f, "EF01CO03");
    r.exemplos = [r.texto];
  });
  rejeita(/exemplo é idêntico ao texto da habilidade/);
});

test("trocar a explicação entre duas habilidades (nada contável muda) é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    const a = reg(f, "EF02CO01");
    const b = reg(f, "EF02CO02");
    [a.explicacao, b.explicacao] = [b.explicacao, a.explicacao];
  });
  rejeita(/registros aprovados .* não bate/);
});

test("uma relação transversal tratada como habilidade (EM13MAT315 como registro) é rejeitada", () => {
  mutar("ensino-medio", (f) => {
    const clone = structuredClone(reg(f, "EM13CO26"));
    clone.codigo = "EM13MAT315";
    f.registros.push(clone);
  });
  rejeita(/código com formato inválido|não existe na tabela canônica/);
});

test("uma relação transversal apontando para um código desta própria base é rejeitada", () => {
  mutar("ensino-medio", (f) => {
    reg(f, "EM13CO05").relacoes_transversais[0].codigo = "EM13CO01";
  });
  rejeita(/relação transversal com código inválido|é um código desta própria base/);
});

test("a frase da relação transversal deixada dentro do texto da habilidade é rejeitada", () => {
  mutar("ensino-medio", (f) => {
    reg(f, "EM13CO05").texto = "Possui relação direta com (EM13MAT315).";
  });
  rejeita(/tamanho implausível|começa como explicação|código entre parênteses|infinitivo/);
});

test("cabeçalho/rodapé vazando para o texto é rejeitado", () => {
  for (const vazamento of [" COMPUTAÇÃO - 1º ANO", " EXPLICAÇÃO DA HABILIDADE", " ENSINO FUNDAMENTAL", " Diagramação: Christian Brackmann"]) {
    mutar("anos-iniciais", (f) => {
      reg(f, "EF01CO01").texto = reg(f, "EF01CO01").texto.replace(/\.$/, `${vazamento}.`);
    });
    rejeita(/vazou para o texto|registros aprovados/, vazamento);
    cpSync(join(DIR_FONTE_REAL, arquivoFonte("anos-iniciais")), join(dir, arquivoFonte("anos-iniciais")));
  }
});

test("duplicação causada por continuação de tabela (a mesma habilidade repetida na página seguinte) é rejeitada", () => {
  mutar("anos-iniciais", (f) => {
    const clone = structuredClone(reg(f, "EF01CO06"));
    clone.quadro_fonte = "COMPUTAÇÃO - 1º ANO (CONTINUAÇÃO)";
    f.registros.push(clone);
  });
  rejeita(/código duplicado|esperados exatamente 50 registros/);
});

test("marcador '(cont.)' de continuação de tabela deixado no objeto de conhecimento é rejeitado", () => {
  mutar("anos-finais", (f) => {
    reg(f, "EF09CO05").objeto_conhecimento = "Sistemas distribuídos e internet (cont.)";
  });
  rejeita(/vazou para o texto|diverge do canônico/);
});

test("palavra quebrada ('responsabilidad e') de volta no objeto de conhecimento é rejeitada", () => {
  mutar("anos-finais", (f) => {
    reg(f, "EF09CO06").objeto_conhecimento = "Segurança e responsabilidad e no uso da tecnologia";
  });
  rejeita(/diverge do canônico/);
});

test("eixo inexistente ou eixo nulo no Ensino Fundamental é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    reg(f, "EF01CO01").eixo = "Pensamento Lógico";
  });
  rejeita(/eixo inexistente/);
});

test("objeto de conhecimento ausente no Ensino Fundamental é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    reg(f, "EF01CO01").objeto_conhecimento = null;
  });
  rejeita(/objeto de conhecimento ausente/);
});

test("texto vazio e texto truncado são rejeitados", () => {
  mutar("anos-iniciais", (f) => {
    reg(f, "EF01CO01").texto = "";
  });
  rejeita(/texto da habilidade vazio/);
  cpSync(join(DIR_FONTE_REAL, arquivoFonte("anos-iniciais")), join(dir, arquivoFonte("anos-iniciais")));
  mutar("anos-iniciais", (f) => {
    reg(f, "EF01CO01").texto = "Organizar objetos físicos ou digitais considerando diferentes";
  });
  rejeita(/não termina em pontuação|registros aprovados/);
});

test("hash SHA-256 da fonte com formato inválido é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    f.fontes[0].sha256 = f.fontes[0].sha256.slice(0, 63);
  });
  rejeita(/sha256 inválido/);
});

test("hash SHA-256 do Anexo alterado (formato válido, valor diferente) é rejeitado contra o literal aprovado", () => {
  mutar("anos-iniciais", (f) => {
    f.fontes[0].sha256 = "0".repeat(64);
  });
  rejeita(/não é o hash literal aprovado/);
});

test("URL fora do domínio oficial é rejeitada (domínio estranho, gov.br de outro órgão e host parecido)", () => {
  for (const url of [
    "https://example.com/anexo.pdf",
    "https://www.gov.br/outro-orgao/anexo.pdf",
    "https://www.gov.br.evil.example/mec/anexo.pdf",
    "https://basenacionalcomum.mec.gov.br.evil.example/x.pdf",
    "ftp://www.gov.br/mec/anexo.pdf",
  ]) {
    mutar("anos-iniciais", (f) => {
      f.fontes[0].url = url;
    });
    rejeita(/URL fora do domínio oficial/, url);
    cpSync(join(DIR_FONTE_REAL, arquivoFonte("anos-iniciais")), join(dir, arquivoFonte("anos-iniciais")));
  }
});

test("adulterar os metadados documentais (correções, divergências, introdução) é rejeitado", () => {
  mutar("anos-finais", (f) => {
    f.correcoes_tipograficas[0].justificativa += " (editado)";
  });
  rejeita(/metadados do arquivo-fonte/);
});

test("adulterar a divergência documentada das competências do Ensino Médio é rejeitado", () => {
  mutar("ensino-medio", (f) => {
    const c = f.competencias[3];
    c.texto_no_quadro_de_habilidades = c.texto;
    c.textos_divergem = false;
  });
  rejeita(/contradiz a divergência documentada|registros aprovados/);
});

test("as 7 competências do Ensino Fundamental divergindo entre os dois arquivos do EF são rejeitadas", () => {
  mutar("anos-finais", (f) => {
    f.competencias[0].texto += " ";
  });
  rejeita(/espaços nas bordas|registros aprovados|idênticas/);
});

test("remover uma nota documental (EF05CO06) é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    reg(f, "EF05CO06").notas_documentais = [];
  });
  rejeita(/registros aprovados .* não bate/);
});

test("corrigir por conta própria a inversão impressa de EF05CO06/07 (trocar explicação e exemplos) é rejeitado: a fonte é preservada como impressa", () => {
  mutar("anos-iniciais", (f) => {
    const a = reg(f, "EF05CO06");
    const b = reg(f, "EF05CO07");
    [a.explicacao, b.explicacao] = [b.explicacao, a.explicacao];
    [a.exemplos, b.exemplos] = [b.exemplos, a.exemplos];
  });
  rejeita(/registros aprovados .* não bate/);
});

test("nome do catálogo remetendo a currículo estadual é rejeitado", () => {
  mutar("anos-iniciais", (f) => {
    f.nome_oficial = "Computação — Currículo Paulista";
  });
  rejeita(/nome oficial inesperado|currículo estadual/);
});

test("schema, escopo e arquivo-fonte ilegível são rejeitados", () => {
  mutar("anos-iniciais", (f) => {
    f.escopo = "anos-finais";
  });
  rejeita(/diferente do escopo esperado/);
  writeFileSync(join(dir, arquivoFonte("anos-iniciais")), "{ não é json");
  rejeita(/JSON inválido/);
});
