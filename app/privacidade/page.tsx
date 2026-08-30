import type { Metadata } from "next";
import { ArrowUpRight, EyeOff, Lock, ShieldCheck } from "lucide-react";

const CONTACT_EMAIL = "tempodocente@gmail.com";
const CLOUDFLARE_PRIVACY_URL = "https://www.cloudflare.com/privacypolicy/";

const PAGE_DESCRIPTION =
  "Como o Tempo Docente utiliza métricas agregadas da Cloudflare, sem cookies de analytics ou criação de perfis individuais.";

export const metadata: Metadata = {
  title: "Privacidade | Tempo Docente",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/privacidade" },
  openGraph: {
    title: "Privacidade | Tempo Docente",
    description: PAGE_DESCRIPTION,
    url: "/privacidade",
  },
};

export default function PrivacidadePage() {
  return (
    <>
      <section className="privacidade-intro">
        <div className="container">
          <nav className="privacidade-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Início</a><span aria-hidden="true">/</span>
            <span aria-current="page">Privacidade</span>
          </nav>
          <div className="section-kicker"><span /> Privacidade</div>
          <h1>Privacidade</h1>
          <p className="privacidade-lede">
            O Tempo Docente é uma ferramenta gratuita de consulta à BNCC e a resultados do SARESP, sem cadastro e
            sem login. Esta página explica, em linguagem simples, que métricas agregadas são utilizadas, para quê,
            e quais compromissos o projeto assume sobre o que não é — nem será — enviado nessas métricas.
          </p>
          <p className="privacidade-lede">
            <strong>
              No domínio tempodocente.com.br, o Cloudflare Web Analytics está ativo por injeção automática da
              infraestrutura da Cloudflare. Os eventos próprios de métricas do Tempo Docente ainda não existem.
            </strong>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container privacidade-prose">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Métricas</span>
              <h2>O que é medido</h2>
            </div>
          </div>
          <p>
            Há três camadas distintas de medição envolvidas neste site. Vale separá-las, porque só a terceira
            depende de uma decisão do Tempo Docente:
          </p>
          <ul className="privacidade-list">
            <li>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                <strong>Métricas operacionais da infraestrutura.</strong> Como o site é servido através da
                Cloudflare, a infraestrutura dela pode produzir métricas agregadas sobre requisições e tráfego.
                Isso decorre do próprio funcionamento da hospedagem.
              </span>
            </li>
            <li>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                <strong>Cloudflare Web Analytics — ativo.</strong> No domínio tempodocente.com.br, a Cloudflare
                insere automaticamente, na borda da rede dela, um pequeno script de medição quando a página é
                entregue ao navegador. Ele mede visualizações de páginas e indicadores de desempenho (como a
                velocidade de carregamento) e envia esses dados ao endereço /cdn-cgi/rum, no próprio domínio.
                Esse script <strong>não foi adicionado manualmente ao código do site</strong>: ele não existe no
                repositório do projeto e não aparece nas versões de teste, que ficam fora da zona da Cloudflare.
              </span>
            </li>
            <li>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                <strong>Eventos próprios do Tempo Docente — ainda não existem.</strong> Medições específicas das
                ferramentas (por exemplo, o uso de um filtro ou a exportação de um relatório) não estão
                implementadas. Continuam sendo apenas uma possibilidade futura e não devem ser confundidas com o
                Cloudflare Web Analytics descrito acima.
              </span>
            </li>
          </ul>
          <p>
            As métricas das duas primeiras camadas descrevem o comportamento coletivo de quem visita o site, não o
            de uma pessoa específica.
          </p>
        </div>
      </section>

      <section className="section privacidade-limits">
        <div className="container privacidade-prose">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Limites</span>
              <h2>O que o Tempo Docente não faz</h2>
            </div>
          </div>
          <p>
            Estes são os compromissos que dependem de decisões do próprio Tempo Docente. Valem hoje e
            continuarão valendo caso os eventos próprios de produto venham a existir. O Tempo Docente:
          </p>
          <ul className="privacidade-list">
            <li><Lock size={18} aria-hidden="true" /> Não exige cadastro ou login para usar qualquer ferramenta</li>
            <li><EyeOff size={18} aria-hidden="true" /> Não exibe publicidade nem faz remarketing</li>
            <li><EyeOff size={18} aria-hidden="true" /> Não cria nem pretende criar perfis individuais de visitantes</li>
            <li><Lock size={18} aria-hidden="true" /> Não usa nem pretende usar cookies de analytics</li>
            <li><EyeOff size={18} aria-hidden="true" /> Não incluirá o texto livre digitado nas buscas nos eventos próprios de métricas do produto</li>
            <li><EyeOff size={18} aria-hidden="true" /> Não incluirá nome ou código de escola nos eventos próprios de métricas do produto</li>
            <li><Lock size={18} aria-hidden="true" /> Não criará identificador persistente de visitante nos eventos próprios de métricas do produto</li>
            <li><EyeOff size={18} aria-hidden="true" /> Não usa nem pretende usar técnicas de fingerprinting (identificação indireta por características do navegador ou do dispositivo)</li>
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container privacidade-prose">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Infraestrutura</span>
              <h2>Funcionamento normal do site</h2>
            </div>
          </div>
          <p>
            Como qualquer site na internet, entregar as páginas do Tempo Docente exige que a infraestrutura que o
            hospeda — a Cloudflare — processe informações técnicas de cada solicitação, como o endereço IP de
            origem, para entregar as páginas, manter a segurança, detectar abusos e operar a infraestrutura. Isso
            faz parte do funcionamento normal de qualquer site.
          </p>
          <p>
            Entre essas informações técnicas estão a URL solicitada e o caminho da requisição. Isso é relevante
            porque algumas funcionalidades usam a própria URL para funcionar: a busca da BNCC aparece como
            parâmetro no endereço da página, e a consulta de uma escola no SARESP carrega um arquivo de dados cujo
            caminho contém o código dessa escola. Ou seja, a infraestrutura necessariamente processa esses
            endereços para entregar o conteúdo — o Tempo Docente não tem como impedir isso, e não seria correto
            prometer o contrário.
          </p>
          <p>
            O tratamento dessas informações técnicas e seus períodos de retenção seguem as políticas da própria
            Cloudflare, descritas na política de privacidade dela (link na seção seguinte). O Tempo Docente não
            define esses prazos.
          </p>
          <p>
            Esse processamento técnico de infraestrutura é diferente dos eventos próprios de produto, que ainda
            não existem. O compromisso do projeto está no que ele decide enviar: caso esses eventos passem a
            existir, não incluirão o texto livre de busca, nem nome ou código de escola, nem identificador
            persistente de visitante. O projeto também não pretende usar o endereço IP para criar perfis
            individuais nem para identificar professores.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container privacidade-prose">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Uso</span>
              <h2>Para que essas informações são usadas</h2>
            </div>
          </div>
          <p>
            As métricas agregadas de acesso e desempenho servem exclusivamente para orientar melhorias no
            conteúdo, na navegação, no desempenho e nas ferramentas do Tempo Docente — por exemplo, entender
            quais páginas merecem mais atenção. Elas não são usadas para publicidade, venda a terceiros ou
            qualquer forma de identificação individual.
          </p>
          <p>
            Se, no futuro, o Tempo Docente passar a medir também interações específicas dentro das ferramentas
            (como o uso de um filtro ou a exportação de um relatório), essas medições seguirão os mesmos limites
            descritos nesta página — sempre agregadas, sem texto livre, sem identificação de escola e sem
            identificador pessoal — e esta página será atualizada antes disso entrar em vigor.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container privacidade-prose">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Fornecedor</span>
              <h2>Quem processa essas métricas</h2>
            </div>
          </div>
          <p>
            Quem processa essas métricas é a Cloudflare, a mesma empresa que hospeda o site — tanto as métricas
            operacionais da infraestrutura quanto os dados do Cloudflare Web Analytics, que são enviados a um
            endereço do próprio domínio. Você pode consultar a política de privacidade da Cloudflare no link
            abaixo; ela também cobre o processamento técnico de infraestrutura descrito acima.
          </p>
          <a className="text-link" href={CLOUDFLARE_PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            Política de privacidade da Cloudflare <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="section privacidade-closing">
        <div className="container privacidade-prose">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Contato e atualizações</span>
              <h2>Dúvidas e mudanças nesta página</h2>
            </div>
          </div>
          <p>
            Dúvidas sobre esta página podem ser enviadas para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
          <p>
            Qualquer mudança relevante nas métricas descritas nesta página será refletida aqui. Em especial, se
            o Tempo Docente passar a coletar eventos próprios de produto, esta página será atualizada antes de
            isso entrar em vigor.
          </p>
          <p className="privacidade-updated">Última atualização: 30 de agosto de 2026.</p>
        </div>
      </section>
    </>
  );
}
