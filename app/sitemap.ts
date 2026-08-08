import type { MetadataRoute } from "next";
import { COMPONENTES_ANOS_FINAIS, getAllRegistros } from "@/lib/bncc/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://tempodocente.com.br";
  const staticRoutes = [
    "",
    "/bncc",
    "/bncc/competencias-gerais",
    "/bncc/ensino-fundamental",
    ...COMPONENTES_ANOS_FINAIS.flatMap((componente) => [
      `/bncc/${componente.slug}`,
      ...[6, 7, 8, 9].map((year) => `/bncc/${componente.slug}/${year}-ano`),
    ]),
  ];
  return [
    ...staticRoutes.map((route) => ({ url: `${baseUrl}${route}`, changeFrequency: "monthly" as const, priority: route === "" ? 1 : 0.8 })),
    ...getAllRegistros()
      .filter((registro) => registro.codigo)
      .map((registro) => ({ url: `${baseUrl}/bncc/${registro.codigo!.toLowerCase()}`, changeFrequency: "yearly" as const, priority: 0.7 })),
  ];
}
