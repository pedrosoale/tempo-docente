import type { MetadataRoute } from "next";
import { AREAS_ENSINO_MEDIO, COMPONENTES_ANOS_FINAIS, getAllRegistros } from "@/lib/bncc/data";
import { uniqueSorted } from "@/lib/bncc/search.mjs";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://tempodocente.com.br";
  const staticRoutes = [
    "",
    "/bncc",
    "/bncc/competencias-gerais",
    "/bncc/ensino-fundamental",
    ...COMPONENTES_ANOS_FINAIS.flatMap((componente) => {
      const years = uniqueSorted(componente.skills.flatMap((skill) => skill.anos_aplicaveis ?? [skill.ano]));
      return [
        `/bncc/${componente.slug}`,
        ...years.map((year) => `/bncc/${componente.slug}/${year[0]}-ano`),
      ];
    }),
    "/bncc/ensino-medio",
    ...AREAS_ENSINO_MEDIO.map((area) => `/bncc/ensino-medio/${area.slug}`),
    "/saresp",
  ];
  return [
    ...staticRoutes.map((route) => ({ url: `${baseUrl}${route}`, changeFrequency: "monthly" as const, priority: route === "" ? 1 : 0.8 })),
    ...getAllRegistros()
      .filter((registro) => registro.codigo)
      .map((registro) => ({ url: `${baseUrl}/bncc/${registro.codigo!.toLowerCase()}`, changeFrequency: "yearly" as const, priority: 0.7 })),
  ];
}
