// Seletor explícito entre a matriz tradicional (2001) e a matriz alinhada à BNCC — duas publicações
// distintas do Inep, nunca convertidas uma na outra (ver lib/saeb/descritores.ts e
// lib/saeb/matriz-bncc.ts). Trocar de matriz troca todo o conteúdo servido por
// app/saeb/matriz/page.tsx — texto explicativo, filtros, resultados e fontes —, não só um parâmetro
// de filtro dentro da mesma matriz; por isso a troca é uma NAVEGAÇÃO REAL, nunca um estado de
// cliente. Deliberadamente SEM `useRouter`/`router.push`/`next/link`/`history.pushState` — este
// projeto roda em vinext/Cloudflare Workers e já teve falhas de navegação em produção com a camada
// de navegação client-side do Next; um <form method="get"> HTML nativo funciona sem depender dela e
// sem exigir JavaScript no navegador.
//
// Um único formulário GET com action="/saeb/matriz": o botão "Matriz tradicional" não tem `name`,
// então submetê-lo produz a URL limpa "/saeb/matriz" (sem matriz/etapa/componente/busca herdados da
// matriz anterior, que têm vocabulários incompatíveis — ver comentário em app/saeb/matriz/page.tsx);
// o botão "Matriz alinhada à BNCC" tem `name="matriz" value="bncc"`, produzindo
// "/saeb/matriz?matriz=bncc". Nenhum componente de cliente é necessário — <button type="submit">
// dentro de um <form> ativa nativamente por Enter e Espaço e funciona com JavaScript desabilitado.
export type MatrizSelecionada = "tradicional" | "bncc";

export default function MatrizSeletor({ matrizSelecionada }: { matrizSelecionada: MatrizSelecionada }) {
  return (
    <form method="get" action="/saeb/matriz" className="saeb-matriz-seletor" role="group" aria-label="Selecionar matriz de referência">
      <button
        type="submit"
        aria-pressed={matrizSelecionada === "tradicional" ? "true" : "false"}
        className={`saeb-matriz-seletor-opcao${matrizSelecionada === "tradicional" ? " is-active" : ""}`}
      >
        Matriz tradicional (2001)
      </button>
      <button
        type="submit"
        name="matriz"
        value="bncc"
        aria-pressed={matrizSelecionada === "bncc" ? "true" : "false"}
        className={`saeb-matriz-seletor-opcao${matrizSelecionada === "bncc" ? " is-active" : ""}`}
      >
        Matriz alinhada à BNCC
      </button>
    </form>
  );
}
