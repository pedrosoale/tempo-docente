import type { Metadata } from "next";
import { catalogoDescritores } from "@/lib/saeb/descritores";
import type { ComponentePiloto } from "@/lib/saeb/escalas";
import type { Etapa } from "@/lib/saeb/types";
import { buscarFonte, type ComponenteMatrizBncc, type EtapaMatrizBncc } from "@/lib/saeb/matriz-bncc";
import MatrizConsulta from "./components/MatrizConsulta";
import MatrizBnccConsulta from "./components/MatrizBnccConsulta";
import MatrizSeletor, { type MatrizSelecionada } from "./components/MatrizSeletor";

const ETAPAS_VALIDAS: Etapa[] = ["anosIniciais", "anosFinais", "ensinoMedio"];
const COMPONENTES_VALIDOS: ComponentePiloto[] = ["lp", "mt"];

function ehEtapaValida(valor: string | undefined): valor is Etapa {
  return !!valor && (ETAPAS_VALIDAS as string[]).includes(valor);
}

function ehComponenteValido(valor: string | undefined): valor is ComponentePiloto {
  return !!valor && (COMPONENTES_VALIDOS as string[]).includes(valor);
}

// Vocabulário da matriz BNCC — deliberadamente SEPARADO do da matriz tradicional acima, mesmo
// reutilizando os mesmos NOMES de parâmetro de URL (`etapa`, `componente`). Um valor válido só para
// uma matriz é sempre inválido para a outra (ex.: "anosIniciais" não é uma etapa BNCC válida,
// "2anoEF" não é uma etapa tradicional válida) — isso é o que impede uma troca de matriz de herdar
// silenciosamente um filtro incompatível: se a URL ainda tiver o valor da matriz anterior, ele
// simplesmente não valida aqui e cai no fallback seguro desta matriz, nunca é reinterpretado.
const ETAPAS_BNCC_VALIDAS: EtapaMatrizBncc[] = ["2anoEF", "5anoEF", "9anoEF"];
const COMPONENTES_BNCC_VALIDOS: ComponenteMatrizBncc[] = ["linguagens", "matematica"];

function ehEtapaBnccValida(valor: string | undefined): valor is EtapaMatrizBncc {
  return !!valor && (ETAPAS_BNCC_VALIDAS as string[]).includes(valor);
}

function ehComponenteBnccValido(valor: string | undefined): valor is ComponenteMatrizBncc {
  return !!valor && (COMPONENTES_BNCC_VALIDOS as string[]).includes(valor);
}

const COMPONENTE_LABEL_BNCC: Record<ComponenteMatrizBncc, string> = {
  linguagens: "Linguagens/Língua Portuguesa",
  matematica: "Matemática",
};

/** Um parâmetro de busca repetido na URL (ex.: "?busca=D1&busca=D2") chega aqui como array, não como
 * string — sem essa normalização, chamar `.trim()` direto num array lançava TypeError e derrubava a
 * rota com 500. Sempre usa só o primeiro valor, e nunca lança para qualquer formato de entrada. */
function primeiroValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

const MATRIZES_E_ESCALAS_URL = "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/saeb/matrizes-e-escalas";
const CARTILHA_SAEB_2025_URL =
  "https://download.inep.gov.br/publicacoes/institucionais/avaliacoes_e_exames_da_educacao_basica/cartilha_saeb_2025_diretrizes_da_edicao.pdf";

const PAGE_TITLE = "Matrizes de referência do SAEB | Tempo Docente";
// Descrição neutra às duas matrizes (nunca deve favorecer uma sobre a outra): tradicional (2001,
// descritores) e alinhada à BNCC (habilidades), Língua Portuguesa/Linguagens e Matemática, com os
// eixos de busca que cada uma realmente suporta — código só "quando oficialmente existente"
// (Matemática da BNCC e a tradicional têm código; Linguagens da BNCC nunca tem).
const PAGE_DESCRIPTION =
  "Consulte a matriz de referência do SAEB: a tradicional (2001), com descritores, e a alinhada à BNCC, com habilidades — em Língua Portuguesa/Linguagens e Matemática, por etapa, componente, código oficial (quando existente) ou palavra-chave.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/saeb/matriz" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/saeb/matriz",
  },
};

type MatrizPageProps = {
  searchParams?: Promise<{
    matriz?: string | string[];
    etapa?: string | string[];
    componente?: string | string[];
    busca?: string | string[];
  }>;
};

export default async function SaebMatrizPage({ searchParams }: MatrizPageProps) {
  const params = await searchParams;
  // Parâmetros inválidos, ausentes ou repetidos (ex.: "?busca=D1&busca=D2") nunca quebram a página —
  // caem no recorte padrão (5º ano, Língua Portuguesa) ou no primeiro valor informado, o mesmo
  // comportamento de "retorno seguro" já usado pelas páginas da BNCC.
  const etapaParam = primeiroValor(params?.etapa);
  const componenteParam = primeiroValor(params?.componente);
  const buscaParam = primeiroValor(params?.busca);
  const initialEtapa: Etapa = ehEtapaValida(etapaParam) ? etapaParam : "anosIniciais";
  const initialComponente: ComponentePiloto = ehComponenteValido(componenteParam) ? componenteParam : "lp";
  const initialBusca = buscaParam?.trim() ?? "";

  // `matriz` ausente, "tradicional" ou qualquer valor não reconhecido: matriz tradicional (o padrão,
  // para preservar links e favoritos já existentes desta página). Só "bncc" exatamente ativa a
  // matriz alinhada à BNCC — nunca um fallback silencioso entre as duas: um valor não reconhecido
  // sempre cai na tradicional, nunca é interpretado como "talvez BNCC".
  const matrizParam = primeiroValor(params?.matriz);
  const matrizSelecionada: MatrizSelecionada = matrizParam === "bncc" ? "bncc" : "tradicional";

  // Vocabulário da matriz BNCC (etapa/componente) — parsing inteiramente separado do da matriz
  // tradicional acima, mesmo reutilizando os mesmos nomes de parâmetro de URL (ver comentário perto
  // de ehEtapaBnccValida). Só avaliado/exibido quando matrizSelecionada === "bncc".
  const initialEtapaBncc: EtapaMatrizBncc = ehEtapaBnccValida(etapaParam) ? etapaParam : "2anoEF";
  const initialComponenteBncc: ComponenteMatrizBncc = ehComponenteBnccValido(componenteParam) ? componenteParam : "linguagens";
  const initialBuscaBncc = buscaParam?.trim() ?? "";

  return (
    <>
      <section className="saeb-intro saeb-matriz-intro">
        <div className="container">
          <nav className="saeb-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Início</a><span aria-hidden="true">/</span>
            <a href="/saeb">SAEB</a><span aria-hidden="true">/</span>
            <span aria-current="page">Matrizes de referência</span>
          </nav>
          <div className="section-kicker"><span /> Matriz de referência</div>
          <h1>Matrizes de referência do SAEB</h1>

          <MatrizSeletor matrizSelecionada={matrizSelecionada} />

          {matrizSelecionada === "tradicional" ? (
            <>
              <p className="saeb-lede">
                Consulte os descritores da matriz de referência <strong>tradicional (2001)</strong> do SAEB em Língua Portuguesa e Matemática, nas
                três etapas cobertas por este piloto: 5º ano e 9º ano do Ensino Fundamental e 3ª série do Ensino Médio.
              </p>
              <div className="saeb-matriz-transicao">
                <p>
                  <strong>Sobre a transição de matrizes:</strong> desde 2019 o Saeb está em transição — a matriz tradicional (2001), mostrada aqui,
                  está sendo progressivamente substituída por matrizes alinhadas à Base Nacional Comum Curricular (BNCC), com estrutura e
                  terminologia próprias (ver a página oficial{" "}
                  <a href={MATRIZES_E_ESCALAS_URL} target="_blank" rel="noopener noreferrer">
                    &ldquo;Matrizes e Escalas&rdquo;
                  </a>{" "}
                  do Inep).
                </p>
                <p>
                  Para a edição de 2025 especificamente, a cartilha oficial{" "}
                  <a href={CARTILHA_SAEB_2025_URL} target="_blank" rel="noopener noreferrer">
                    &ldquo;Saeb 2025 — Diretrizes da edição&rdquo;
                  </a>{" "}
                  afirma que, no 5º e 9º ano do Ensino Fundamental e na 3ª e 4ª série do Ensino Médio, os estudantes fazem as provas de Língua
                  Portuguesa e Matemática com o mesmo conteúdo das edições anteriores do Saeb — conteúdo que a própria cartilha associa tanto à
                  BNCC quanto à matriz de 2001. Esta consulta cobre apenas a matriz tradicional (2001); os descritores mostrados aqui não
                  representam a matriz alinhada à BNCC.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="saeb-lede">
                Consulte as habilidades da matriz de referência do SAEB <strong>alinhada à Base Nacional Comum Curricular (BNCC)</strong>, em
                Linguagens/Língua Portuguesa e Matemática — 2º, 5º e 9º ano do Ensino Fundamental.
              </p>
              <div className="saeb-matriz-transicao">
                <p>
                  <strong>Em que esta matriz difere da tradicional:</strong> a matriz tradicional (2001) usa <em>descritores</em> identificados
                  como &ldquo;D1&rdquo;, &ldquo;D2&rdquo; etc.; esta matriz usa <em>habilidades</em>. Os códigos oficiais de Matemática desta
                  matriz (ex.: &ldquo;5E2.3&rdquo;) pertencem a um sistema totalmente diferente do &ldquo;D&lt;n&gt;&rdquo; da matriz
                  tradicional — <strong>não existe conversão automática entre um descritor tradicional e uma habilidade desta matriz</strong>.
                  Linguagens não possui códigos oficiais nesta publicação.
                </p>
                <p>
                  Esta matriz cobre o <strong>2º, 5º e 9º ano do Ensino Fundamental</strong>; ela <strong>não contém a 3ª série do Ensino
                  Médio</strong> nos dois documentos auditados neste piloto. No 5º e 9º ano, Linguagens também inclui Arte, Educação Física e,
                  no 9º ano, Língua Inglesa.
                </p>
                <p>
                  A aplicação de Língua Portuguesa e Matemática do 2º ano é documentada desde o Saeb 2019 (Saeb — Documentos de Referência
                  v1.0, Inep, 2018). Para o 5º e o 9º ano, a formulação documentalmente segura é: a matriz está publicada pelo Inep; a
                  auditoria documental deste projeto não confirmou uma edição específica do Saeb em que esta matriz de Língua
                  Portuguesa/Matemática tenha sido aplicada. A existência desta publicação não deve, por si só, ser lida como prova de
                  aplicação em uma edição específica.
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          {matrizSelecionada === "tradicional" ? (
            <>
              <div className="saeb-matriz-explicacao">
                <h2 className="sr-only">O que é a matriz de referência</h2>
                <ul>
                  <li>A matriz de referência orienta a construção dos itens de uma avaliação — não é o currículo completo, mas um recorte dele.</li>
                  <li>Os descritores indicam habilidades avaliadas dentro desse recorte, agrupadas por tópico (Língua Portuguesa) ou tema (Matemática).</li>
                  <li>
                    A média de proficiência de uma escola <strong>não permite diagnosticar diretamente</strong> o domínio de cada descritor — a
                    matriz descreve o que pode ser avaliado, não o que uma turma específica aprendeu.
                  </li>
                  <li>Consultar os descritores ajuda a compreender o escopo da avaliação, mas não substitui uma análise pedagógica da turma.</li>
                </ul>
              </div>

              <MatrizConsulta initialEtapa={initialEtapa} initialComponente={initialComponente} initialBusca={initialBusca} />

              <p className="saeb-fonte saeb-matriz-fonte-rodape">
                Fontes oficiais: <a href={catalogoDescritores.fontes.lp.url} target="_blank" rel="noopener noreferrer">{catalogoDescritores.fontes.lp.titulo}</a>{" "}
                e <a href={catalogoDescritores.fontes.mt.url} target="_blank" rel="noopener noreferrer">{catalogoDescritores.fontes.mt.titulo}</a> —{" "}
                {catalogoDescritores.fontes.lp.orgao}, {catalogoDescritores.fontes.lp.versaoPublicacao}.
              </p>
            </>
          ) : (
            <>
              <div className="saeb-matriz-explicacao">
                <h2 className="sr-only">O que é a matriz alinhada à BNCC</h2>
                <ul>
                  <li>Esta matriz também orienta a construção dos itens de uma avaliação — não é o currículo completo, mas um recorte dele.</li>
                  <li>As habilidades são agrupadas por eixo do conhecimento (ex.: Leitura, Números) e, quando existir, por eixo cognitivo.</li>
                  <li>
                    A média de proficiência de uma escola <strong>não permite diagnosticar diretamente</strong> o domínio de cada habilidade — a
                    matriz descreve o que pode ser avaliado, não o que uma turma específica aprendeu.
                  </li>
                  <li>Consultar as habilidades ajuda a compreender o escopo da avaliação, mas não substitui uma análise pedagógica da turma.</li>
                </ul>
              </div>

              <MatrizBnccConsulta initialEtapa={initialEtapaBncc} initialComponente={initialComponenteBncc} initialBusca={initialBuscaBncc} />

              <div className="saeb-fonte saeb-matriz-fonte-rodape saeb-matriz-fontes-bncc">
                <p className="saeb-matriz-fontes-bncc-titulo">Fontes e proveniência</p>
                {(["linguagens", "matematica"] as const).map((comp) => {
                  const fonte = buscarFonte(comp);
                  return (
                    <div key={comp} className="saeb-matriz-fonte-proveniencia">
                      <p>
                        <strong>{COMPONENTE_LABEL_BNCC[comp]}:</strong>{" "}
                        <a href={fonte.url} target="_blank" rel="noopener noreferrer">
                          {fonte.titulo}
                        </a>{" "}
                        — {fonte.orgao}, {fonte.anoPublicacao}. Consulta em {fonte.dataConsulta}.
                      </p>
                      <p className="saeb-matriz-hash">
                        SHA-256: <code>{fonte.hashSha256}</code>
                      </p>
                      <p className="saeb-nao-informado">{fonte.situacaoAplicacao}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
