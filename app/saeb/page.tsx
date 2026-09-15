import type { Metadata } from "next";
import {
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Database,
  Info,
  Layers,
  MapPinned,
  School,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import SaebConsulta from "./components/SaebConsulta";

const SAEB_RESULTS_URL = "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/saeb/resultados/";
const IDEB_RESULTS_URL = "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados";
const SAEB_MICRODATA_URL = "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/saeb";

const PAGE_TITLE = "SAEB e Ideb: como interpretar os indicadores | Tempo Docente";
const PAGE_DESCRIPTION =
  "Página explicativa sobre o SAEB, o Ideb, o Censo Escolar e o que significa proficiência, com os cuidados necessários para interpretar esses indicadores — e uma consulta interativa por escola, com evolução histórica opcional.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/saeb" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/saeb",
  },
};

// Motivos oficialmente previstos para um resultado não ser divulgado. Descritos
// em linguagem corrente de propósito: os códigos técnicos usados nas planilhas
// do Inep (ND, ND*, ND**, ND***) só fazem sentido junto do dado, e não têm
// utilidade para quem apenas quer entender por que a escola aparece sem número.
const MISSING_RESULT_REASONS = [
  {
    title: "Poucos estudantes presentes",
    body: "A avaliação exige um número mínimo de participantes para que o resultado tenha significado estatístico. Abaixo desse mínimo, o Inep não divulga.",
  },
  {
    title: "Participação abaixo do exigido",
    body: "Mesmo com estudantes presentes, é preciso alcançar uma proporção mínima dos matriculados na etapa avaliada. Faltas no dia da aplicação afetam esse cálculo.",
  },
  {
    title: "Etapa não avaliada naquela edição",
    body: "Nem toda edição do SAEB avalia as mesmas etapas e os mesmos componentes. A ausência pode significar apenas que aquela etapa não fez parte da edição.",
  },
  {
    title: "Escola não existia ou não ofertava a etapa",
    body: "Escolas abrem, fecham, mudam de rede e alteram as etapas que oferecem. Uma lacuna no histórico costuma refletir a própria trajetória da unidade.",
  },
  {
    title: "Pedido de não divulgação previsto em norma",
    body: "Há situações, previstas em portaria do Inep, em que a rede ou a escola solicita que o resultado não seja divulgado publicamente.",
  },
  {
    title: "Problema na aplicação ou no material",
    body: "Extravio de material e ocorrências durante a aplicação podem impedir o cálculo. É um problema operacional, sem relação com o desempenho dos estudantes.",
  },
];

export default function SaebPage() {
  return (
    <>
      <section className="saeb-intro">
        <div className="container">
          <nav className="saeb-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Início</a><span aria-hidden="true">/</span>
            <span aria-current="page">SAEB</span>
          </nav>
          <div className="section-kicker"><span /> Avaliação externa</div>
          <h1>SAEB: resultados educacionais com contexto</h1>
          <p className="saeb-lede">
            Esta página explica o que o SAEB mede, como ele se distingue do Ideb e do Censo Escolar, o que
            significa proficiência e quais cuidados são necessários para ler esses números sem tirar conclusões
            que os dados não sustentam.
          </p>
          <p className="saeb-status">
            <Info size={19} aria-hidden="true" />
            <span>
              A consulta por escola está disponível logo abaixo, com um painel opcional de evolução histórica por
              indicador e etapa. Esta página continua sendo a camada explicativa que dá contexto a ela, e é útil
              por si só para quem precisa interpretar resultados já publicados pelo Inep.
            </span>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Consulta</span>
              <h2>Consulte uma escola</h2>
            </div>
          </div>
          <div className="saeb-prose">
            <p>
              Busque pelo município e depois pela escola. Os resultados mostram só as etapas e edições em que a
              escola de fato tem dado divulgado pelo Inep — e separam a proficiência do SAEB do Ideb e de seus
              componentes, sem ranking e sem comparação entre escolas.
            </p>
          </div>
          <SaebConsulta />
        </div>
      </section>

      <section className="section">
        <div className="container saeb-prose">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Definição</span>
              <h2>O que é o SAEB</h2>
            </div>
          </div>
          <p>
            O SAEB é o Sistema de Avaliação da Educação Básica, conduzido periodicamente pelo Inep. Ele aplica
            testes de desempenho a estudantes de determinadas etapas e, junto com eles, questionários respondidos
            por estudantes, professores, diretores e gestores das redes.
          </p>
          <p>
            Dessa aplicação saem dois tipos de informação. A primeira é o desempenho dos estudantes nas áreas
            avaliadas, expresso em uma escala de proficiência. A segunda é um retrato de contexto: condições da
            escola, formação docente, perfil socioeconômico do público atendido, entre outros elementos que ajudam
            a interpretar o desempenho em vez de apenas classificá-lo.
          </p>
          <p>
            O conjunto de áreas e etapas avaliadas varia de uma edição para outra. Língua Portuguesa e Matemática
            são as que formam as séries históricas mais longas e contínuas — e são, hoje, o único recorte em que a
            consulta abaixo situa a média da escola dentro dos níveis oficiais de proficiência, num piloto que cobre
            o 5º e o 9º ano do Ensino Fundamental e a 3ª série do Ensino Médio, nas edições com associação
            documentada à escala em cada etapa (inclusive 2025, cuja prova de Língua Portuguesa e Matemática usa a
            mesma matriz de referência das edições anteriores, segundo a documentação oficial do Inep) —, mas o SAEB
            não se limita a elas em caráter permanente: edições recentes também avaliaram Ciências Humanas e
            Ciências da Natureza, e o 2º ano do ensino fundamental tem recorte próprio, voltado à alfabetização.
            Verificar o que foi avaliado em cada edição é parte de ler o dado corretamente.
          </p>
          <p>
            O SAEB é uma avaliação de sistemas e redes de ensino. Ele foi desenhado para descrever o conjunto —
            redes, etapas e territórios —, não para medir o trabalho de um professor específico nem para resumir a
            qualidade total de uma escola. Resultados agregados também podem ser divulgados por escola quando os
            critérios definidos pelo Inep são atendidos; isso não faz da escola uma unidade individualmente
            avaliada, e não significa que toda escola terá resultado em toda edição. Uma escola é feita de muito
            mais do que aquilo que um teste padronizado consegue capturar em um único dia de aplicação — e usar o
            resultado isoladamente com essa finalidade distorce tanto o dado quanto o trabalho de quem está em
            sala.
          </p>
        </div>
      </section>

      <section className="section" id="saeb-ideb-censo">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Distinções</span>
              <h2>SAEB, Ideb e Censo Escolar</h2>
            </div>
          </div>
          <div className="saeb-prose">
            <p>
              Os três nomes aparecem juntos com frequência e são tratados como sinônimos com frequência ainda
              maior. São coisas diferentes, produzidas por processos diferentes, e a confusão entre elas costuma
              estar na origem de leituras equivocadas.
            </p>
          </div>
          <div className="saeb-concepts">
            <article className="saeb-concept">
              <BookOpenCheck size={24} aria-hidden="true" />
              <h3>SAEB</h3>
              <p>
                A avaliação em si. Aplica testes e questionários e produz as proficiências — as medidas de
                desempenho em escala.
              </p>
              <span className="saeb-concept-role">Origem: avaliação aplicada a estudantes</span>
            </article>
            <article className="saeb-concept">
              <Database size={24} aria-hidden="true" />
              <h3>Censo Escolar</h3>
              <p>
                O levantamento anual da educação básica. Registra matrículas, turmas, docentes e infraestrutura, e
                é dele que vêm as taxas de aprovação, reprovação e abandono — o rendimento escolar.
              </p>
              <span className="saeb-concept-role">Origem: declaração das redes e escolas</span>
            </article>
            <article className="saeb-concept">
              <BarChart3 size={24} aria-hidden="true" />
              <h3>Ideb</h3>
              <p>
                Um indicador calculado a partir das outras duas fontes: combina o desempenho medido pelo SAEB com
                o rendimento escolar apurado pelo Censo Escolar.
              </p>
              <span className="saeb-concept-role">Origem: cálculo que combina as duas anteriores</span>
            </article>
          </div>
          <div className="saeb-prose saeb-prose-follow">
            <p>
              A consequência prática dessa distinção é direta. O Ideb não é uma nota do SAEB, nem uma média de
              provas: uma escola pode ter proficiência estável e ver o Ideb variar porque o rendimento mudou, e o
              contrário também acontece. Ler as duas dimensões separadamente é o que permite entender <em>por
              quê</em> um indicador se moveu.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container saeb-prose">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Medida</span>
              <h2>O que significa proficiência</h2>
            </div>
          </div>
          <p>
            Proficiência é uma medida de desempenho expressa em uma escala construída pelo Inep. Ela não é a
            porcentagem de acertos na prova, e não é uma nota escolar comum: não vai de zero a dez, não equivale a
            um conceito do boletim e não corresponde ao que um estudante individual tirou.
          </p>
          <p>
            O que a escala permite é comparar desempenho agregado — de uma escola, de um município, de uma rede —
            entre grupos e ao longo do tempo, mesmo quando as provas aplicadas não foram exatamente as mesmas. É
            justamente para isso que ela existe.
          </p>
          <p>
            Essa flexibilidade tem limites que precisam ser respeitados. A escala usada e a forma de interpretá-la
            dependem da etapa e do componente avaliado — o 2º ano do ensino fundamental, por exemplo, tem escala
            específica, própria do recorte de alfabetização. Resultados de recortes incompatíveis não devem ser
            comparados diretamente, nem somados, nem convertidos entre si, porque não estão na mesma régua.
          </p>
          <p>
            Além disso, nem toda comparação entre edições é direta. O conjunto de etapas e componentes avaliados
            mudou ao longo das edições, e algumas delas trazem ressalvas metodológicas registradas pelo próprio
            Inep nas notas técnicas que acompanham a divulgação. Comparar sem verificar essas ressalvas é o erro
            mais comum na leitura desses dados — e o mais fácil de evitar, porque a documentação oficial é
            pública.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Ausências</span>
              <h2>Por que uma escola pode não ter resultado divulgado</h2>
            </div>
          </div>
          <div className="saeb-prose">
            <p>
              Encontrar uma escola sem número em determinada edição é comum e quase sempre tem explicação
              administrativa ou estatística. As situações mais frequentes são estas:
            </p>
          </div>
          <ul className="saeb-reasons">
            {MISSING_RESULT_REASONS.map((reason) => (
              <li key={reason.title}>
                <strong>{reason.title}</strong>
                <span>{reason.body}</span>
              </li>
            ))}
          </ul>
          <div className="saeb-prose saeb-prose-follow">
            <p>
              <strong>
                Ausência de resultado não significa baixo desempenho.
              </strong>{" "}
              Nenhum dos motivos acima diz qualquer coisa sobre a aprendizagem dos estudantes daquela escola. Ler
              um espaço vazio como sinal negativo é uma inferência que os dados não autorizam, e é exatamente o
              tipo de conclusão que uma ferramenta bem construída precisa impedir em vez de facilitar.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Roteiro</span>
              <h2>O que a consulta já oferece, e o que falta</h2>
            </div>
          </div>
          <div className="saeb-prose">
            <p>
              A ferramenta de consulta, acima, já cobre parte destes compromissos: seleção de município e escola,
              fonte identificada por indicador, ausências explicadas em vez de silenciadas, um painel de evolução
              histórica por escola (gráfico e tabela), e — num piloto que cobre o 5º e o 9º ano do Ensino
              Fundamental e a 3ª série do Ensino Médio, em Língua Portuguesa e Matemática, nas edições com
              associação documentada à escala em cada etapa (inclusive 2025) — a posição da média da escola nos
              níveis oficiais de proficiência, com comparação opcional entre a edição consultada e a edição
              documentada anterior. O painel nunca estima uma distribuição percentual de estudantes por nível: essa
              informação, quando existir para a escola, está apenas na consulta oficial do Boletim da Escola.
              Comparação territorial e exportação continuam pendentes:
            </p>
          </div>
          <h3 className="saeb-list-heading">Já disponível</h3>
          <ul className="saeb-list">
            <li>
              <MapPinned size={18} aria-hidden="true" />
              <span>Selecionar o município e, dentro dele, a escola.</span>
            </li>
            <li>
              <TrendingUp size={18} aria-hidden="true" />
              <span>Ver a trajetória histórica da escola ao longo das edições disponíveis, em gráfico e em tabela.</span>
            </li>
            <li>
              <Database size={18} aria-hidden="true" />
              <span>Identificar a fonte oficial de cada indicador exibido, indicador por indicador.</span>
            </li>
            <li>
              <Info size={18} aria-hidden="true" />
              <span>Explicar cada ausência de resultado e cada ressalva metodológica no ponto em que ela aparece.</span>
            </li>
            <li>
              <BookOpenCheck size={18} aria-hidden="true" />
              <span>
                Situar a média da escola nos níveis oficiais de proficiência — piloto que cobre o 5º e o 9º ano do
                Ensino Fundamental e a 3ª série do Ensino Médio, em Língua Portuguesa e Matemática, nas edições com
                associação documentada à escala em cada etapa (inclusive 2025), com comparação opcional entre
                edições; o painel nunca estima quantos estudantes estão em cada nível.
              </span>
            </li>
          </ul>
          <h3 className="saeb-list-heading">Pendente</h3>
          <ul className="saeb-list">
            <li>
              <Layers size={18} aria-hidden="true" />
              <span>Comparar a trajetória da escola com o município, a unidade da Federação e o Brasil.</span>
            </li>
            <li>
              <School size={18} aria-hidden="true" />
              <span>Exportar os dados consultados com os códigos oficiais preservados.</span>
            </li>
          </ul>
          <h3 className="saeb-list-heading">Decisão de projeto</h3>
          <ul className="saeb-list">
            <li>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                Não produzir ranking, ordenação competitiva nem qualquer lista de melhores ou piores escolas.
              </span>
            </li>
          </ul>
          <div className="saeb-prose saeb-prose-follow">
            <p>
              O item acima é uma decisão de projeto, não uma limitação técnica. Ordenar escolas por resultado
              transforma um instrumento de gestão em exposição pública de comunidades escolares que atendem
              públicos muito diferentes, em condições muito diferentes. A comparação que ajuda o professor é
              contra a própria trajetória da escola e contra as referências territoriais — não contra a escola
              vizinha.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container saeb-prose">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Interpretação</span>
              <h2>Uso responsável dos indicadores</h2>
            </div>
          </div>
          <p>
            Todo indicador é um recorte da realidade. O SAEB observa parte do currículo — as áreas avaliadas em
            cada edição —, em etapas específicas e em um momento determinado. O Ideb acrescenta o fluxo escolar.
            Nenhum dos dois enxerga o trabalho cotidiano de uma escola inteira, e nenhum foi construído com essa
            pretensão.
          </p>
          <p>
            Ler bem esses números exige olhar junto o contexto da escola, a taxa de participação naquela
            aplicação e a trajetória ao longo do tempo. Um único ponto isolado diz muito pouco; uma série
            histórica, acompanhada das ressalvas da edição, já permite formular perguntas úteis.
          </p>
          <p>
            O uso que faz sentido é o pedagógico: apoiar a reflexão coletiva, orientar o planejamento, ajudar a
            decidir onde investir tempo e atenção. Esses dados <strong>não devem ser usados isoladamente para
            responsabilizar professores, estudantes ou comunidades escolares</strong>, nem para justificar
            premiação, punição ou classificação de pessoas.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Fontes</span>
              <h2>Fontes e metodologia</h2>
            </div>
          </div>
          <div className="saeb-prose">
            <p>
              A consulta usa exclusivamente arquivos oficiais publicados pelo Inep. As páginas abaixo são as fontes
              primárias — vale consultá-las diretamente, inclusive as notas técnicas que acompanham cada
              divulgação:
            </p>
          </div>
          <div className="saeb-sources">
            <a href={SAEB_RESULTS_URL} target="_blank" rel="noopener noreferrer">
              <span className="saeb-source-text">
                <strong>Resultados do SAEB — Inep</strong>
                <span>Planilhas de resultados, notas técnicas e relatórios, organizados por edição.</span>
              </span>
              <ArrowUpRight size={19} aria-hidden="true" />
            </a>
            <a href={IDEB_RESULTS_URL} target="_blank" rel="noopener noreferrer">
              <span className="saeb-source-text">
                <strong>Resultados do Ideb — Inep</strong>
                <span>Resultados por escola, município, unidade da Federação e Brasil, com as notas informativas do indicador.</span>
              </span>
              <ArrowUpRight size={19} aria-hidden="true" />
            </a>
            <a href={SAEB_MICRODATA_URL} target="_blank" rel="noopener noreferrer">
              <span className="saeb-source-text">
                <strong>Microdados do SAEB — Inep</strong>
                <span>Bases detalhadas, dicionários de variáveis e documentação técnica das edições.</span>
              </span>
              <ArrowUpRight size={19} aria-hidden="true" />
            </a>
          </div>
          <p className="saeb-attribution">
            Fonte: Ministério da Educação — Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira
            (MEC/Inep). O Tempo Docente não modifica os valores oficiais; organiza e contextualiza os dados,
            preservando a edição e o arquivo de origem de cada indicador, exibidos junto de cada resultado
            consultado acima.
          </p>
        </div>
      </section>
    </>
  );
}
