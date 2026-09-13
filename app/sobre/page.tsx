import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, Mail } from "lucide-react";

const LATTES_URL = "https://lattes.cnpq.br/9478556199676330";
const CONTACT_EMAIL = "tempodocente@gmail.com";

export const metadata: Metadata = {
  title: "Sobre o Tempo Docente | Professor Alexandre Pedroso",
  description: "Conheça o Professor Alexandre Pedroso, mestre em Matemática e criador do Tempo Docente, projeto que aproxima educação, dados e tecnologia.",
  alternates: { canonical: "/sobre" },
  openGraph: {
    title: "Sobre o Tempo Docente | Professor Alexandre Pedroso",
    description: "Conheça o Professor Alexandre Pedroso, mestre em Matemática e criador do Tempo Docente, projeto que aproxima educação, dados e tecnologia.",
    url: "/sobre",
  },
};

// Dados estruturados: só o aprovado para publicação (sem empregador, escola,
// telefone, endereço, e-mail pessoal ou perfil social inexistente). Escapar
// "<" evita que um valor futuro feche a tag <script> prematuramente — mesmo
// não havendo entrada de usuário aqui, é a forma segura padrão de serializar
// JSON-LD.
const profileJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  name: "Sobre o Tempo Docente | Professor Alexandre Pedroso",
  url: "https://tempodocente.com.br/sobre",
  isPartOf: {
    "@type": "WebSite",
    name: "Tempo Docente",
    url: "https://tempodocente.com.br",
  },
  mainEntity: {
    "@type": "Person",
    name: "Alexandre Pedroso",
    jobTitle: "Professor de Matemática",
    description: "Professor de Matemática, mestre em Matemática e criador do Tempo Docente.",
    url: "https://tempodocente.com.br/sobre",
    sameAs: [LATTES_URL],
  },
};
const profileJsonLdScript = JSON.stringify(profileJsonLd).replace(/</g, "\\u003c");

export default function SobrePage() {
  return (
    <>
      {/* JSON-LD estático, sem entrada de usuário — ver profileJsonLdScript acima para o escape de segurança. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: profileJsonLdScript }} />

      <section className="sobre-intro">
        <div className="container">
          <nav className="sobre-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Início</a><span aria-hidden="true">/</span>
            <span aria-current="page">Sobre</span>
          </nav>

          <div className="sobre-intro-grid">
            <div className="sobre-intro-copy">
              <div className="section-kicker"><span /> Sobre o Tempo Docente</div>
              <h1>Professor Alexandre Pedroso</h1>
              <p>
                Professor de Matemática, mestre em Matemática e criador do Tempo Docente. Sua trajetória reúne
                experiência na Educação Básica e no Ensino Superior, formação em Física e tecnologia e interesse
                pelo desenvolvimento de recursos que tornem o conhecimento e os dados educacionais mais
                acessíveis aos professores.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href={LATTES_URL} target="_blank" rel="noopener noreferrer">
                  Conhecer o currículo Lattes <ArrowUpRight size={17} aria-hidden="true" />
                </a>
                <a className="button button-secondary" href="/bncc">Explorar a BNCC</a>
                <a className="button button-secondary" href={`mailto:${CONTACT_EMAIL}`}>
                  Entrar em contato <Mail size={16} aria-hidden="true" />
                </a>
              </div>
              <div className="sobre-credentials" aria-label="Credenciais">
                <span>Mestre em Matemática · PROFMAT</span>
                <span>Licenciado em Matemática e Física</span>
              </div>
            </div>

            <figure className="sobre-photo sobre-portrait">
              {/* Asset já otimizado, servido diretamente pelo Worker sem endpoint de transformação. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/sobre/alexandre-pedroso-131.webp" width={960} height={1440}
                alt="Professor Alexandre Pedroso sorrindo, de camisa azul clara, à mesa com livros de Matemática."
                fetchPriority="high" decoding="async" />
              <figcaption>Professor Alexandre Pedroso</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container sobre-story-grid">
          <figure className="sobre-photo sobre-story-photo">
            {/* Asset já otimizado; manter enquadramento integral e assinatura do fotógrafo. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/sobre/alexandre-pedroso-74.webp" width={1200} height={800}
              alt="Alexandre Pedroso com um notebook e livros, sorrindo à mesa."
              loading="lazy" decoding="async" />
            <figcaption>Educação, dados e tecnologia.</figcaption>
          </figure>
          <div className="sobre-prose">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Motivação</span>
              <h2>Por que criei o Tempo Docente</h2>
            </div>
          </div>
          <p>
            O Tempo Docente nasceu da experiência cotidiana com os desafios enfrentados por professores para
            localizar, organizar e interpretar informações curriculares e resultados educacionais. Documentos
            oficiais e bases públicas contêm informações valiosas, mas nem sempre são fáceis de consultar.
          </p>
          <p>
            O projeto busca transformar essas informações em ferramentas mais claras, práticas e transparentes,
            ajudando professores a encontrar referências curriculares, compreender resultados e tomar decisões
            pedagógicas com mais segurança.
          </p>
          </div>
        </div>
      </section>

      <section className="section quick-access">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Trajetória</span>
              <h2>Uma trajetória entre educação e tecnologia</h2>
            </div>
          </div>
          <div className="sobre-info-grid">
            <div className="sobre-info-item">
              <h3>Educação Básica</h3>
              <p>
                Experiência no ensino de Matemática nos anos finais do Ensino Fundamental e no Ensino Médio,
                além de formação e experiência no ensino de Física.
              </p>
            </div>
            <div className="sobre-info-item">
              <h3>Ensino Superior</h3>
              <p>Experiência docente em disciplinas de Matemática e Física em diferentes cursos de graduação.</p>
            </div>
            <div className="sobre-info-item">
              <h3>Formação acadêmica</h3>
              <p>
                Mestre em Matemática pelo PROFMAT da Universidade Federal do Triângulo Mineiro, especialista em
                Ensino de Física pela Universidade Estadual de Campinas, especialista em Matemática Aplicada,
                licenciado em Matemática e Física, e graduado em Análise e Desenvolvimento de Sistemas.
              </p>
            </div>
            <div className="sobre-info-item">
              <h3>Tecnologia educacional</h3>
              <p>
                Interesse e produção acadêmica envolvendo simulações computacionais, modelagem matemática,
                análise de algoritmos e desenvolvimento de soluções digitais para a educação.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Pesquisa</span>
              <h2>Pesquisa aplicada ao ensino e à tecnologia</h2>
            </div>
          </div>
          <p className="sobre-prose" style={{ marginBottom: 8 }}>
            A produção acadêmica de Alexandre Pedroso reúne Matemática, Física, ensino e computação, com
            trabalhos voltados à aplicação prática do conhecimento e ao uso de tecnologias em contextos
            educacionais.
          </p>
          <div className="sobre-research-grid">
            <article className="sobre-research-item">
              <span className="sobre-research-number">1</span>
              <h3>Equações diferenciais em problemas de vazão e mistura de fluidos</h3>
              <p>Dissertação de mestrado voltada à aplicação de equações diferenciais ordinárias em problemas de modelagem matemática.</p>
            </article>
            <article className="sobre-research-item">
              <span className="sobre-research-number">2</span>
              <h3>Simulações computacionais no ensino de Física</h3>
              <p>Estudo sobre o uso de recursos interativos no ensino de ondulatória e seu potencial para apoiar o interesse e a aprendizagem dos estudantes.</p>
            </article>
            <article className="sobre-research-item">
              <span className="sobre-research-number">3</span>
              <h3>Desempenho de algoritmos de ordenação</h3>
              <p>Análise da complexidade temporal de algoritmos de ordenação, aproximando formação matemática e computação.</p>
            </article>
          </div>
          <a className="text-link" href={LATTES_URL} target="_blank" rel="noopener noreferrer">
            Ver a produção acadêmica completa no currículo Lattes <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="section trust-section">
        <div className="container sobre-prose">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Transparência</span>
              <h2>Transparência como princípio</h2>
            </div>
          </div>
          <p>
            O Tempo Docente organiza informações provenientes de documentos e bases oficiais. As funcionalidades
            são desenvolvidas com identificação das fontes, validações automatizadas e revisão dos resultados
            apresentados.
          </p>
          <p>
            Tecnologias de automação e inteligência artificial podem apoiar o desenvolvimento do projeto, mas
            não substituem as fontes oficiais nem a revisão responsável das informações.
          </p>
          <div className="sobre-info-grid" style={{ marginTop: 28 }}>
            <div className="sobre-info-item">
              <h3>Utilidade</h3>
              <p>Recursos pensados para o dia a dia de quem ensina.</p>
            </div>
            <div className="sobre-info-item">
              <h3>Transparência</h3>
              <p>Fontes sempre identificadas, sem informação anônima.</p>
            </div>
            <div className="sobre-info-item">
              <h3>Clareza</h3>
              <p>Dados apresentados de forma direta e compreensível.</p>
            </div>
            <div className="sobre-info-item">
              <h3>Responsabilidade</h3>
              <p>Tecnologia a serviço da revisão cuidadosa, nunca no lugar dela.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section sobre-closing">
        <div className="container sobre-prose">
          <p>O Tempo Docente é um projeto independente, desenvolvido para aproximar professores de informações que podem apoiar seu trabalho.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/bncc">Explorar a BNCC <ArrowRight size={17} aria-hidden="true" /></a>
            <a className="button button-secondary" href="/saresp">Consultar o SARESP</a>
            <a className="button button-secondary" href={LATTES_URL} target="_blank" rel="noopener noreferrer">Conhecer o currículo Lattes</a>
            <a className="button button-secondary" href={`mailto:${CONTACT_EMAIL}`}>Enviar um e-mail</a>
          </div>
        </div>
      </section>
    </>
  );
}
