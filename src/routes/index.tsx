import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "PontoFlex — Ponto eletrônico para sua empresa" },
      {
        name: "description",
        content: "Controle de jornada, registro de ponto com GPS e relatórios de frequência.",
      },
      { property: "og:title", content: "PontoFlex — Ponto eletrônico para sua empresa" },
      {
        property: "og:description",
        content: "Controle de jornada, registro de ponto com GPS e relatórios de frequência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
