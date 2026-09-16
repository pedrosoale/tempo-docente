import type { Metadata } from "next";
import { catalogoDescritores } from "@/lib/saeb/descritores";
import type { ComponentePiloto } from "@/lib/saeb/escalas";
import type { Etapa } from "@/lib/saeb/types";
import MatrizConsulta from "./components/MatrizConsulta";

const ETAPAS_VALIDAS: Etapa[] = ["anosIniciais", "anosFinais", "ensinoMedio"];
const COMPONENTES_VALIDOS: ComponentePiloto[] = ["lp", "mt"];

function ehEtapaValida(valor: string | undefined): valor is Etapa {
  return !!valor && (ETAPAS_VALIDAS as string[]).includes(valor);
}

function ehComponenteValido(valor: string | undefined): valor is ComponentePiloto {
  return !!valor && (COMPONENTES_VALIDOS as string[]).includes(valor);
}

/** Um parâmetro de busca repetido na URL (ex.: "?busca=D1&busca=D2") chega aqui como array, não como
 * string — sem essa normalização, chamar `.trim()` direto num array lançava TypeError e derrubava a
 * rota com 500. Sempre usa só o primeiro valor, e nunca lança para qualquer formato de entrada. */
function primeiroValor(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

const MATRIZES_E_ESCALAS_URL = "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/saeb/matrizes-e-escalas";
const CARTILHA_SAEB_2025_URL =
  "https://download.inep.gov.br/publicacoes/institucionais/avaliacoes_e_exames_da_educacao_basica/cartilha_saeb_2025_diretrizes_da_edicao.pdf";

const PAGE_TITLE = "Matriz de referência e descritores do SAEB | Tempo Docente";
const PAGE_DESCRIPTION =
  "Consulte os descritores da matriz de referência tradicional (2001) do SAEB em Língua Portuguesa e Matemática — 5º ano e 9º ano do Ensino Fundamental e 3ª série do Ensino Médio — com busca por código ou palavra-chave.";

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
  searchParams?: Promise<{ etapa?: string | string[]; componente?: string | string[]; busca?: string | string[] }>;
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

  return (
    <>
      <section className="saeb-intro saeb-matriz-intro">
        <div className="container">
          <nav className="saeb-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Início</a><span aria-hidden="true">/</span>
            <a href="/saeb">SAEB</a><span aria-hidden="true">/</span>
            <span aria-current="page">Matriz e descritores</span>
          </nav>
          <div className="section-kicker"><span /> Matriz de referência</div>
          <h1>Matriz de referência e descritores do SAEB</h1>
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
        </div>
      </section>

      <section className="section">
        <div className="container">
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
        </div>
      </section>
    </>
  );
}
